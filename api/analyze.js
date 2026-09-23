export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée.",
    });
  }

  try {
    /*
     * On récupère le formulaire multipart envoyé
     * par notre index.html.
     */
    const form = await parseMultipartForm(req);

    const action = form.action;

    const image = form.image;

    if (!image || !image.buffer) {
      return res.status(400).json({
        error: "Aucune image n'a été reçue.",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "La clé API OpenAI n'est pas configurée.",
      });
    }

    /*
     * Conversion de l'image en base64
     * pour l'envoyer à l'IA.
     */
    const base64Image =
      image.buffer.toString("base64");

    const mimeType =
      image.contentType ||
      "image/jpeg";

    const imageDataUrl =
      `data:${mimeType};base64,${base64Image}`;


    /* =====================================================
       ÉTAPE 1 — ANALYSE DE L'IMAGE
       ===================================================== */

    if (action === "analyze") {

      const prompt = `
Tu es un expert en conception de patrons de tapestry crochet.

Analyse l'image fournie AVANT de créer un patron.

Ton objectif est de déterminer comment transformer cette image en un motif de tapestry crochet reconnaissable, esthétique et réalisable.

Analyse :

- le sujet principal ;
- les éléments secondaires importants ;
- la composition ;
- le cadrage ;
- le rapport largeur / hauteur ;
- les formes importantes ;
- les détails à conserver ;
- les détails pouvant être supprimés ;
- les zones de contraste ;
- les couleurs importantes ;
- le niveau de simplification nécessaire.

Le patron doit privilégier la reconnaissance du sujet plutôt que la reproduction exacte de chaque détail.

Détermine également :

1. plusieurs dimensions de grille adaptées ;
2. une dimension recommandée ;
3. un nombre de couleurs recommandé ;
4. un nombre minimum raisonnable de couleurs ;
5. un nombre maximum raisonnable de couleurs.

Règles :

- maximum 120 mailles sur un côté ;
- minimum 20 mailles sur un côté ;
- une image carrée doit donner des formats carrés ;
- une image portrait doit donner des formats portrait ;
- une image paysage doit donner des formats paysage ;
- le nombre de couleurs doit être compris entre 2 et 20 ;
- privilégie la simplicité lorsqu'elle permet de conserver la reconnaissance du sujet.

Réponds uniquement avec un JSON valide.

Format attendu :

{
  "description": "...",
  "important_elements": ["...", "..."],
  "composition": "...",
  "aspect_ratio": "...",
  "simplification_strategy": "...",
  "recommended_dimensions": [
    {
      "width": 40,
      "height": 40
    },
    {
      "width": 60,
      "height": 60
    },
    {
      "width": 80,
      "height": 80
    }
  ],
  "recommended_colors": 6,
  "min_colors": 4,
  "max_colors": 8
}
`;

      const result =
        await callOpenAI({
          apiKey,
          imageDataUrl,
          prompt,
          maxTokens: 3000,
        });

      let analysis;

      try {
        analysis = extractJson(result);
      } catch (error) {

        console.error(
          "Réponse IA non JSON :",
          result
        );

        return res.status(500).json({
          error:
            "L'IA a renvoyé une réponse impossible à interpréter.",
        });
      }

      return res.status(200).json(
        cleanAnalysis(analysis)
      );
    }


    /* =====================================================
       ÉTAPE 2 — GÉNÉRATION DU PATRON
       ===================================================== */

    if (action === "generate") {

      const width =
        clamp(
          parseInt(form.width, 10) || 60,
          20,
          120
        );

      const height =
        clamp(
          parseInt(form.height, 10) || 60,
          20,
          120
        );

      const colors =
        clamp(
          parseInt(form.colors, 10) || 8,
          2,
          20
        );


      let analysis = null;

      if (form.analysis) {

        try {
          analysis =
            JSON.parse(form.analysis);
        } catch (error) {
          analysis = null;
        }
      }


      const prompt =
        buildGenerationPrompt({
          width,
          height,
          colors,
          analysis,
        });


      const result =
        await callOpenAI({
          apiKey,
          imageDataUrl,
          prompt,
          maxTokens: 12000,
        });


      let generated;

      try {
        generated =
          extractJson(result);
      } catch (error) {

        console.error(
          "Réponse génération non JSON :",
          result
        );

        return res.status(500).json({
          error:
            "L'IA n'a pas renvoyé un patron exploitable.",
        });
      }


      const validated =
        validatePattern(
          generated,
          width,
          height,
          colors
        );


      if (!validated.valid) {

        console.error(
          "Patron invalide :",
          validated.error
        );

        return res.status(500).json({
          error:
            "Le patron généré par l'IA n'est pas valide. Réessaie.",
        });
      }


      return res.status(200).json({
        width,
        height,
        colors,
        palette:
          validated.palette,
        grid:
          validated.grid,
      });
    }


    return res.status(400).json({
      error: "Action inconnue.",
    });

  } catch (error) {

    console.error(
      "Erreur API :",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Une erreur est survenue.",
    });
  }
}


/* ============================================================
   LECTURE DU FORMULAIRE MULTIPART
   ============================================================ */

async function parseMultipartForm(req) {

  const contentType =
    req.headers["content-type"] || "";

  const boundaryMatch =
    contentType.match(
      /boundary="?([^";]+)"?/i
    );

  if (!boundaryMatch) {

    throw new Error(
      "Impossible de lire le formulaire envoyé."
    );
  }

  const boundary =
    Buffer.from(
      "--" + boundaryMatch[1]
    );


  const chunks = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }


  const body =
    Buffer.concat(chunks);


  const form = {};

  let position = 0;


  while (position < body.length) {

    const boundaryPosition =
      body.indexOf(
        boundary,
        position
      );

    if (boundaryPosition === -1) {
      break;
    }


    position =
      boundaryPosition +
      boundary.length;


    /*
     * Fin du multipart.
     */
    if (
      body[position] === 45 &&
      body[position + 1] === 45
    ) {
      break;
    }


    /*
     * Saut de ligne après boundary.
     */
    if (
      body[position] === 13 &&
      body[position + 1] === 10
    ) {

      position += 2;
    }


    const headerEnd =
      body.indexOf(
        Buffer.from("\r\n\r\n"),
        position
      );


    if (headerEnd === -1) {
      break;
    }


    const headers =
      body
        .slice(
          position,
          headerEnd
        )
        .toString("utf8");


    position =
      headerEnd + 4;


    const nextBoundary =
      body.indexOf(
        boundary,
        position
      );


    if (nextBoundary === -1) {
      break;
    }


    let contentEnd =
      nextBoundary;


    /*
     * Retirer le CRLF avant le boundary.
     */
    if (
      body[contentEnd - 2] === 13 &&
      body[contentEnd - 1] === 10
    ) {

      contentEnd -= 2;
    }


    const content =
      body.slice(
        position,
        contentEnd
      );


    const dispositionMatch =
      headers.match(
        /Content-Disposition:[^\r\n]*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i
      );


    if (!dispositionMatch) {
      position = nextBoundary;
      continue;
    }


    const fieldName =
      dispositionMatch[1];

    const fileName =
      dispositionMatch[2];


    if (fileName !== undefined) {

      const typeMatch =
        headers.match(
          /Content-Type:\s*([^\r\n]+)/i
        );


      form[fieldName] = {
        buffer: content,
        filename: fileName,
        contentType:
          typeMatch
            ? typeMatch[1].trim()
            : "application/octet-stream",
      };

    } else {

      form[fieldName] =
        content.toString("utf8");
    }


    position =
      nextBoundary;
  }


  return form;
}


/* ============================================================
   APPEL OPENAI
   ============================================================ */

async function callOpenAI({
  apiKey,
  imageDataUrl,
  prompt,
  maxTokens,
}) {

  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`,
        },

        body: JSON.stringify({

          model: "gpt-5.6-luna",

          input: [
            {
              role: "user",

              content: [

                {
                  type: "input_text",
                  text: prompt,
                },

                {
                  type: "input_image",
                  image_url:
                    imageDataUrl,
                },

              ],
            },
          ],

          max_output_tokens:
            maxTokens,
        }),
      }
    );


  if (!response.ok) {

    const errorText =
      await response.text();

    console.error(
      "Erreur OpenAI :",
      errorText
    );

    throw new Error(
      "Erreur lors de la communication avec l'IA."
    );
  }


  const data =
    await response.json();


  return extractResponseText(data);
}


/* ============================================================
   EXTRACTION DE LA RÉPONSE
   ============================================================ */

function extractResponseText(data) {

  if (
    typeof data.output_text ===
    "string"
  ) {

    return data.output_text;
  }


  if (
    Array.isArray(data.output)
  ) {

    const parts = [];


    for (
      const item of data.output
    ) {

      if (
        !Array.isArray(
          item.content
        )
      ) {
        continue;
      }


      for (
        const content of item.content
      ) {

        if (
          typeof content.text ===
          "string"
        ) {

          parts.push(
            content.text
          );
        }
      }
    }


    if (parts.length) {

      return parts.join("\n");
    }
  }


  throw new Error(
    "Impossible de lire la réponse de l'IA."
  );
}


/* ============================================================
   EXTRACTION JSON
   ============================================================ */

function extractJson(text) {

  if (
    typeof text !== "string"
  ) {

    throw new Error(
      "Réponse IA invalide."
    );
  }


  let cleaned =
    text.trim();


  cleaned =
    cleaned
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();


  try {

    return JSON.parse(
      cleaned
    );

  } catch (error) {

    const start =
      cleaned.indexOf("{");

    const end =
      cleaned.lastIndexOf("}");


    if (
      start !== -1 &&
      end !== -1 &&
      end > start
    ) {

      return JSON.parse(
        cleaned.slice(
          start,
          end + 1
        )
      );
    }


    throw error;
  }
}


/* ============================================================
   NETTOYAGE ANALYSE
   ============================================================ */

function cleanAnalysis(data) {

  const rawDimensions =
    Array.isArray(
      data.recommended_dimensions
    )
      ? data.recommended_dimensions
      : [];


  const dimensions =
    rawDimensions
      .map(item => {

        let width;
        let height;


        if (
          Array.isArray(item)
        ) {

          width =
            parseInt(
              item[0],
              10
            );

          height =
            parseInt(
              item[1],
              10
            );

        } else {

          width =
            parseInt(
              item.width,
              10
            );

          height =
            parseInt(
              item.height,
              10
            );
        }


        if (
          !width ||
          !height
        ) {

          return null;
        }


        return {
          width:
            clamp(
              width,
              20,
              120
            ),

          height:
            clamp(
              height,
              20,
              120
            ),
        };

      })
      .filter(Boolean);


  if (!dimensions.length) {

    dimensions.push(
      {
        width: 40,
        height: 40,
      },
      {
        width: 60,
        height: 60,
      },
      {
        width: 80,
        height: 80,
      }
    );
  }


  const recommendedColors =
    clamp(
      parseInt(
        data.recommended_colors,
        10
      ) || 8,
      2,
      20
    );


  const minColors =
    clamp(
      parseInt(
        data.min_colors,
        10
      ) ||
        recommendedColors - 2,
      2,
      recommendedColors
    );


  const maxColors =
    clamp(
      parseInt(
        data.max_colors,
        10
      ) ||
        recommendedColors + 2,
      recommendedColors,
      20
    );


  return {

    description:
      String(
        data.description ||
        "L'image a été analysée."
      ),

    important_elements:
      Array.isArray(
        data.important_elements
      )
        ? data.important_elements
            .map(String)
            .slice(0, 12)
        : [],

    composition:
      String(
        data.composition ||
        ""
      ),

    aspect_ratio:
      String(
        data.aspect_ratio ||
        ""
      ),

    simplification_strategy:
      String(
        data.simplification_strategy ||
        ""
      ),

    recommended_dimensions:
      dimensions.slice(0, 5),

    recommended_colors:
      recommendedColors,

    min_colors:
      minColors,

    max_colors:
      maxColors,
  };
}


/* ============================================================
   PROMPT DE GÉNÉRATION
   ============================================================ */

function buildGenerationPrompt({
  width,
  height,
  colors,
  analysis,
}) {

  let analysisSection = "";


  if (analysis) {

    analysisSection = `
ANALYSE PRÉALABLE :

Sujet :
${analysis.description || ""}

Éléments importants :
${
  Array.isArray(
    analysis.important_elements
  )
    ? analysis.important_elements.join(
        ", "
      )
    : ""
}

Composition :
${analysis.composition || ""}

Rapport :
${analysis.aspect_ratio || ""}

Stratégie de simplification :
${analysis.simplification_strategy || ""}
`;
  }


  return `
Tu dois maintenant créer un patron de tapestry crochet à partir de l'image.

${analysisSection}

PARAMÈTRES :

Largeur : ${width} mailles
Hauteur : ${height} mailles
Nombre de couleurs : ${colors}

OBJECTIF :

Créer un patron reconnaissable et esthétique.

Ne cherche PAS à reproduire chaque pixel.

Simplifie l'image intelligemment.

PRIORITÉS :

1. Sujet principal.
2. Silhouette.
3. Formes principales.
4. Placement des éléments.
5. Contraste.
6. Couleurs cohérentes.
7. Suppression du bruit et des détails inutiles.

RÈGLES DE GRILLE :

- exactement ${height} lignes ;
- exactement ${width} valeurs par ligne ;
- chaque valeur est un entier de 0 à ${colors - 1} ;
- les valeurs correspondent aux indices de la palette ;
- évite les changements de couleur aléatoires ;
- évite le bruit ;
- conserve les grandes zones homogènes ;
- conserve les contours importants.

PALETTE :

Crée exactement ${colors} couleurs.

Réponds UNIQUEMENT avec ce JSON :

{
  "palette": [
    "#000000"
  ],
  "grid": [
    [0,1,1],
    [0,0,1]
  ]
}

La palette doit contenir exactement ${colors} couleurs.

La grille doit contenir exactement ${height} lignes.

Chaque ligne doit contenir exactement ${width} nombres.

Aucun texte avant ou après le JSON.
`;
}


/* ============================================================
   VALIDATION DU PATRON
   ============================================================ */

function validatePattern(
  data,
  width,
  height,
  colors
) {

  if (
    !data ||
    !Array.isArray(
      data.palette
    ) ||
    !Array.isArray(
      data.grid
    )
  ) {

    return {
      valid: false,
      error:
        "Structure de patron absente.",
    };
  }


  if (
    data.palette.length !==
    colors
  ) {

    return {
      valid: false,
      error:
        `La palette contient ${data.palette.length} couleurs au lieu de ${colors}.`,
    };
  }


  if (
    data.grid.length !==
    height
  ) {

    return {
      valid: false,
      error:
        `La grille contient ${data.grid.length} lignes au lieu de ${height}.`,
    };
  }


  const palette =
    data.palette.map(
      color =>
        normalizeHex(color)
    );


  if (
    palette.some(
      color => !color
    )
  ) {

    return {
      valid: false,
      error:
        "Une ou plusieurs couleurs sont invalides.",
    };
  }


  for (
    let rowIndex = 0;
    rowIndex < height;
    rowIndex++
  ) {

    const row =
      data.grid[rowIndex];


    if (
      !Array.isArray(row)
    ) {

      return {
        valid: false,
        error:
          `La ligne ${rowIndex + 1} est invalide.`,
      };
    }


    if (
      row.length !== width
    ) {

      return {
        valid: false,
        error:
          `La ligne ${rowIndex + 1} contient ${row.length} cases au lieu de ${width}.`,
      };
    }


    for (
      let colIndex = 0;
      colIndex < width;
      colIndex++
    ) {

      const value =
        Number(
          row[colIndex]
        );


      if (
        !Number.isInteger(
          value
        ) ||
        value < 0 ||
        value >= colors
      ) {

        return {
          valid: false,
          error:
            `Valeur invalide à la position ${rowIndex + 1}, ${colIndex + 1}.`,
        };
      }


      row[colIndex] =
        value;
    }
  }


  return {
    valid: true,
    palette,
    grid: data.grid,
  };
}


/* ============================================================
   UTILITAIRES
   ============================================================ */

function normalizeHex(value) {

  if (
    typeof value !== "string"
  ) {

    return null;
  }


  const color =
    value.trim();


  if (
    /^#[0-9a-fA-F]{6}$/.test(
      color
    )
  ) {

    return color.toUpperCase();
  }


  if (
    /^#[0-9a-fA-F]{3}$/.test(
      color
    )
  ) {

    return (
      "#" +
      color[1] + color[1] +
      color[2] + color[2] +
      color[3] + color[3]
    ).toUpperCase();
  }


  return null;
}


function clamp(
  value,
  min,
  max
) {

  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}
