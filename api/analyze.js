export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  try {
    const form = await req.formData();

    const action = form.get("action");
    const image = form.get("image");

    if (!image) {
      return res.status(400).json({
        error: "Aucune image n'a été fournie."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "La clé API OpenAI n'est pas configurée."
      });
    }

    const imageBuffer = Buffer.from(
      await image.arrayBuffer()
    );

    const mimeType =
      image.type || "image/jpeg";

    const base64Image =
      imageBuffer.toString("base64");

    const imageDataUrl =
      `data:${mimeType};base64,${base64Image}`;

    /* =========================================================
       ÉTAPE 1 : ANALYSE DE L'IMAGE
       ========================================================= */

    if (action === "analyze") {

      const prompt = `
Tu es un expert en conception de patrons de tapestry crochet.

Tu dois analyser l'image fournie AVANT de penser à une grille de crochet.

Ton objectif est de déterminer comment transformer cette image en un motif de tapestry crochet reconnaissable, esthétique et réalisable.

Analyse notamment :

- le sujet principal ;
- les éléments secondaires importants ;
- la composition ;
- le cadrage ;
- le rapport largeur / hauteur ;
- les formes importantes ;
- les détails qui doivent absolument être conservés ;
- les détails qui peuvent être supprimés ;
- les zones de contraste ;
- les couleurs réellement importantes ;
- le niveau de simplification nécessaire.

Le patron doit privilégier la reconnaissance du sujet plutôt que la reproduction exacte de chaque détail de la photo.

Une photo complexe doit donc être simplifiée intelligemment.

Détermine également :

1. plusieurs dimensions de grille adaptées à la composition ;
2. une dimension recommandée ;
3. un nombre de couleurs recommandé ;
4. un nombre minimum raisonnable de couleurs ;
5. un nombre maximum raisonnable de couleurs.

IMPORTANT :

- Ne propose pas de dimensions absurdes.
- Ne dépasse jamais 120 mailles sur un côté.
- Pour une image carrée, privilégie des formats carrés.
- Pour une image portrait, privilégie des formats portrait.
- Pour une image paysage, privilégie des formats paysage.
- Les dimensions doivent rester raisonnables pour un ouvrage de crochet.
- Le nombre de couleurs doit être compris entre 2 et 20.
- Le nombre recommandé doit être suffisant pour reconnaître l'image mais pas inutilement élevé.

Réponds exclusivement avec un JSON valide.
`;

      const result =
        await callOpenAI({
          apiKey,
          imageDataUrl,
          prompt,
          maxTokens: 3000
        });

      let analysis;

      try {
        analysis =
          extractJson(result);
      } catch (error) {

        console.error(
          "Réponse IA non JSON :",
          result
        );

        return res.status(500).json({
          error:
            "L'IA a renvoyé une réponse impossible à interpréter."
        });

      }

      const cleaned =
        cleanAnalysis(analysis);

      return res.status(200).json(cleaned);
    }


    /* =========================================================
       ÉTAPE 2 : GÉNÉRATION DU PATRON
       ========================================================= */

    if (action === "generate") {

      const width =
        clamp(
          parseInt(form.get("width"), 10) || 60,
          20,
          120
        );

      const height =
        clamp(
          parseInt(form.get("height"), 10) || 60,
          20,
          120
        );

      const colors =
        clamp(
          parseInt(form.get("colors"), 10) || 8,
          2,
          20
        );

      let analysis = null;

      const analysisText =
        form.get("analysis");

      if (analysisText) {

        try {
          analysis =
            JSON.parse(analysisText);
        } catch (error) {
          analysis = null;
        }

      }

      const prompt = buildGenerationPrompt({
        width,
        height,
        colors,
        analysis
      });

      const result =
        await callOpenAI({
          apiKey,
          imageDataUrl,
          prompt,
          maxTokens: 12000
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
            "L'IA n'a pas renvoyé un patron exploitable."
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
            "Le patron généré par l'IA n'est pas valide. Réessaie avec une autre génération."
        });

      }

      return res.status(200).json({
        width,
        height,
        colors,
        palette:
          validated.palette,
        grid:
          validated.grid
      });
    }


    return res.status(400).json({
      error: "Action inconnue."
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error:
        error.message ||
        "Une erreur est survenue."
    });

  }
}


/* ============================================================
   APPEL OPENAI
   ============================================================ */

async function callOpenAI({
  apiKey,
  imageDataUrl,
  prompt,
  maxTokens
}) {

  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${apiKey}`
        },

        body: JSON.stringify({

          model: "gpt-5.6-luna",

          input: [
            {
              role: "user",

              content: [
                {
                  type: "input_text",
                  text: prompt
                },

                {
                  type: "input_image",
                  image_url:
                    imageDataUrl
                }
              ]
            }
          ],

          max_output_tokens:
            maxTokens
        })
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
   EXTRACTION REPONSE OPENAI
   ============================================================ */

function extractResponseText(data) {

  if (
    typeof data.output_text === "string"
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
        !Array.isArray(item.content)
      ) {
        continue;
      }

      for (
        const content of item.content
      ) {

        if (
          typeof content.text === "string"
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


  /*
   * Si l'IA entoure le JSON avec
   * ```json ... ```
   */

  cleaned =
    cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();


  try {

    return JSON.parse(cleaned);

  } catch (error) {

    /*
     * Deuxième tentative :
     * on cherche le premier { et
     * le dernier }.
     */

    const start =
      cleaned.indexOf("{");

    const end =
      cleaned.lastIndexOf("}");


    if (
      start !== -1 &&
      end !== -1 &&
      end > start
    ) {

      const possibleJson =
        cleaned.slice(
          start,
          end + 1
        );

      return JSON.parse(
        possibleJson
      );
    }


    throw error;
  }
}


/* ============================================================
   NETTOYAGE ANALYSE
   ============================================================ */

function cleanAnalysis(data) {

  const dimensions =
    Array.isArray(
      data.recommended_dimensions
    )
      ? data.recommended_dimensions
      : [];


  const cleanedDimensions =
    dimensions
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
            )
        };

      })
      .filter(Boolean);


  /*
   * Si l'IA ne fournit pas suffisamment
   * de dimensions, on crée quelques
   * alternatives cohérentes.
   */

  if (
    cleanedDimensions.length === 0
  ) {

    cleanedDimensions.push(
      { width: 40, height: 40 },
      { width: 60, height: 60 },
      { width: 80, height: 80 }
    );

  }


  const recommended =
    data.recommended_dimensions?.[0];


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
      ) || recommendedColors - 2,
      2,
      recommendedColors
    );


  const maxColors =
    clamp(
      parseInt(
        data.max_colors,
        10
      ) || recommendedColors + 2,
      recommendedColors,
      20
    );


  return {

    description:
      String(
        data.description ||
        data.image_description ||
        data.summary ||
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
      cleanedDimensions.slice(
        0,
        5
      ),

    recommended_colors:
      recommendedColors,

    min_colors:
      minColors,

    max_colors:
      maxColors
  };
}


/* ============================================================
   PROMPT GENERATION PATRON
   ============================================================ */

function buildGenerationPrompt({
  width,
  height,
  colors,
  analysis
}) {

  let analysisSection = "";

  if (analysis) {

    analysisSection = `
ANALYSE PRÉALABLE DE L'IMAGE :

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
Tu es maintenant chargé de créer un patron de tapestry crochet à partir de l'image.

${analysisSection}

PARAMÈTRES DEMANDÉS :

Largeur :
${width} mailles

Hauteur :
${height} mailles

Nombre maximum de couleurs :
${colors}

OBJECTIF :

Créer un patron de crochet qui représente le sujet principal de l'image de manière reconnaissable.

Il ne faut PAS chercher à reproduire chaque pixel de la photo.

Il faut simplifier intelligemment.

PRIORITÉS :

1. Reconnaissance du sujet principal.
2. Silhouette et formes principales.
3. Placement correct des éléments.
4. Contraste suffisant.
5. Couleurs cohérentes.
6. Suppression des détails inutiles.
7. Esthétique du patron.

IMPORTANT POUR LA GRILLE :

- La grille doit contenir exactement ${height} lignes.
- Chaque ligne doit contenir exactement ${width} valeurs.
- Chaque valeur est un entier allant de 0 à ${colors - 1}.
- L'entier correspond à l'index d'une couleur dans la palette.
- Utilise réellement les couleurs de manière pertinente.
- Évite les changements de couleur aléatoires.
- Évite le bruit.
- Les grandes zones doivent rester relativement homogènes.
- Les contours importants doivent être conservés.

PALETTE :

Crée une palette de exactement ${colors} couleurs.

Utilise des couleurs adaptées à l'image.

Le fond doit être traité intelligemment : s'il est peu important, il doit rester simple.

FORMAT DE RÉPONSE :

Réponds UNIQUEMENT avec un JSON valide.

Le JSON doit avoir exactement cette structure :

{
  "palette": [
    "#000000"
  ],
  "grid": [
    [0,1,1],
    [0,0,1]
  ]
}

La propriété "palette" doit contenir exactement ${colors} couleurs.

La propriété "grid" doit contenir exactement ${height} lignes.

Chaque ligne doit contenir exactement ${width} nombres.

Aucun texte avant ou après le JSON.
`;
}


/* ============================================================
   VALIDATION PATRON
   ============================================================ */

function validatePattern(
  data,
  width,
  height,
  colors
) {

  if (
    !data ||
    !Array.isArray(data.palette) ||
    !Array.isArray(data.grid)
  ) {

    return {
      valid: false,
      error:
        "Structure de patron absente."
    };
  }


  if (
    data.palette.length !== colors
  ) {

    return {
      valid: false,
      error:
        `La palette contient ${data.palette.length} couleurs au lieu de ${colors}.`
    };
  }


  if (
    data.grid.length !== height
  ) {

    return {
      valid: false,
      error:
        `La grille contient ${data.grid.length} lignes au lieu de ${height}.`
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
        "Une ou plusieurs couleurs sont invalides."
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
          `La ligne ${rowIndex + 1} est invalide.`
      };
    }


    if (
      row.length !== width
    ) {

      return {
        valid: false,
        error:
          `La ligne ${rowIndex + 1} contient ${row.length} cases au lieu de ${width}.`
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
        !Number.isInteger(value) ||
        value < 0 ||
        value >= colors
      ) {

        return {
          valid: false,
          error:
            `Valeur invalide à la position ${rowIndex + 1}, ${colIndex + 1}.`
        };
      }


      row[colIndex] =
        value;
    }
  }


  return {

    valid: true,

    palette,

    grid:
      data.grid

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
