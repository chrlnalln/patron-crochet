export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const action = body.action;
    const image = body.image;

    if (!image) {
      return res.status(400).json({
        error: "Aucune image n'a été reçue."
      });
    }

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "La clé API OpenAI n'est pas configurée."
      });
    }


    /* =====================================================
       ANALYSE DE L'IMAGE
       ===================================================== */

    if (action === "analyze") {

      const prompt = `
Tu es un expert en conception de patrons de tapestry crochet.

Tu dois analyser cette image AVANT de créer une grille de crochet.

L'objectif n'est PAS de reproduire chaque pixel de l'image.

L'objectif est de déterminer comment simplifier intelligemment l'image afin de créer un patron de tapestry crochet reconnaissable, esthétique et réalisable.

Analyse :

- le sujet principal ;
- les éléments secondaires importants ;
- la composition ;
- le rapport largeur / hauteur ;
- les formes principales ;
- les contours importants ;
- les zones de contraste ;
- les couleurs importantes ;
- les détails qui doivent être conservés ;
- les détails qui peuvent être supprimés ;
- le niveau de simplification nécessaire.

Détermine ensuite :

1. le format de l'image : carré, portrait ou paysage ;
2. 3 à 5 dimensions de grille pertinentes ;
3. la dimension que tu recommandes pour un premier patron ;
4. le nombre de couleurs recommandé ;
5. le nombre minimum de couleurs raisonnable ;
6. le nombre maximum de couleurs raisonnable.

RÈGLES :

- minimum 20 mailles par côté ;
- maximum 120 mailles par côté ;
- si l'image est carrée, privilégie des dimensions carrées ;
- si elle est portrait, privilégie un format portrait ;
- si elle est paysage, privilégie un format paysage ;
- le nombre de couleurs doit être compris entre 2 et 20 ;
- privilégie la reconnaissance du sujet plutôt que la reproduction des détails ;
- évite de proposer des dimensions inutilement grandes.

Réponds UNIQUEMENT avec un JSON valide.

Format :

{
  "description": "description courte du sujet",
  "important_elements": [
    "élément 1",
    "élément 2"
  ],
  "composition": "description de la composition",
  "orientation": "square",
  "simplification_strategy": "explication courte",
  "recommended_dimensions": [
    {
      "width": 40,
      "height": 40
    },
    {
      "width": 50,
      "height": 50
    },
    {
      "width": 60,
      "height": 60
    }
  ],
  "recommended_width": 60,
  "recommended_height": 60,
  "recommended_colors": 6,
  "min_colors": 4,
  "max_colors": 8
}
`;

      const result =
        await callOpenAI(
          apiKey,
          image,
          prompt,
          5000
        );

      let analysis;

      try {
        analysis =
          extractJson(result);
      } catch (error) {
        console.error(result);

        return res.status(500).json({
          error:
            "L'IA a renvoyé une réponse impossible à interpréter."
        });
      }

      return res.status(200).json(
        cleanAnalysis(analysis)
      );
    }


    /* =====================================================
       GÉNÉRATION DU PATRON
       ===================================================== */

    if (action === "generate") {

      const width =
        clamp(
          Number(body.width) || 60,
          20,
          120
        );

      const height =
        clamp(
          Number(body.height) || 60,
          20,
          120
        );

      const colors =
        clamp(
          Number(body.colors) || 6,
          2,
          20
        );

      const analysis =
        body.analysis || null;


      const prompt =
        buildGenerationPrompt({
          width,
          height,
          colors,
          analysis
        });


      const result =
        await callOpenAI(
          apiKey,
          image,
          prompt,
          40000
        );


      let generated;

      try {
        generated =
          extractJson(result);
      } catch (error) {

        console.error(result);

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
          validated.error
        );

        return res.status(500).json({
          error:
            "Le patron généré est invalide : " +
            validated.error
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

async function callOpenAI(
  apiKey,
  image,
  prompt,
  maxTokens
) {

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

          model:
            "gpt-5.6-luna",

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
                  image_url: image
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
    "Réponse OpenAI illisible."
  );
}


/* ============================================================
   EXTRACTION JSON
   ============================================================ */

function extractJson(text) {

  let cleaned =
    String(text).trim();

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
    return JSON.parse(cleaned);
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

  let dimensions = [];

  if (
    Array.isArray(
      data.recommended_dimensions
    )
  ) {

    dimensions =
      data.recommended_dimensions
        .map(item => {

          const width =
            Number(item.width);

          const height =
            Number(item.height);

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
  }


  if (!dimensions.length) {

    dimensions = [
      {
        width: 40,
        height: 40
      },
      {
        width: 50,
        height: 50
      },
      {
        width: 60,
        height: 60
      }
    ];
  }


  let recommendedWidth =
    Number(
      data.recommended_width
    );

  let recommendedHeight =
    Number(
      data.recommended_height
    );


  if (
    !recommendedWidth ||
    !recommendedHeight
  ) {

    recommendedWidth =
      dimensions[0].width;

    recommendedHeight =
      dimensions[0].height;
  }


  const recommendedColors =
    clamp(
      Number(
        data.recommended_colors
      ) || 6,
      2,
      20
    );


  const minColors =
    clamp(
      Number(
        data.min_colors
      ) ||
        Math.max(
          2,
          recommendedColors - 2
        ),
      2,
      recommendedColors
    );


  const maxColors =
    clamp(
      Number(
        data.max_colors
      ) ||
        Math.min(
          20,
          recommendedColors + 2
        ),
      recommendedColors,
      20
    );


  return {

    description:
      String(
        data.description ||
        ""
      ),

    important_elements:
      Array.isArray(
        data.important_elements
      )
        ? data.important_elements
            .map(String)
        : [],

    composition:
      String(
        data.composition ||
        ""
      ),

    orientation:
      String(
        data.orientation ||
        ""
      ),

    simplification_strategy:
      String(
        data.simplification_strategy ||
        ""
      ),

    recommended_dimensions:
      dimensions,

    recommended_width:
      recommendedWidth,

    recommended_height:
      recommendedHeight,

    recommended_colors:
      recommendedColors,

    min_colors:
      minColors,

    max_colors:
      maxColors
  };
}


/* ============================================================
   PROMPT GÉNÉRATION
   ============================================================ */

function buildGenerationPrompt({
  width,
  height,
  colors,
  analysis
}) {

  let analysisText = "";

  if (analysis) {

    analysisText = `
ANALYSE PRÉALABLE DE L'IMAGE

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

Orientation :
${analysis.orientation || ""}

Stratégie de simplification :
${analysis.simplification_strategy || ""}
`;
  }


  return `
Tu es un expert en création de patrons de tapestry crochet.

Tu dois transformer l'image en un patron de crochet.

${analysisText}

PARAMÈTRES DU PATRON :

Largeur :
${width} mailles

Hauteur :
${height} mailles

Nombre de couleurs :
${colors}

OBJECTIF PRINCIPAL :

Créer un patron qui permet de reconnaître clairement le sujet de l'image.

Il ne faut PAS reproduire chaque détail photographique.

Il faut simplifier l'image comme le ferait un graphiste spécialisé dans les grilles de crochet.

PRIORITÉS :

1. Reconnaissance du sujet.
2. Silhouette.
3. Formes principales.
4. Positionnement des éléments.
5. Contraste.
6. Grandes masses de couleur.
7. Détails utiles.
8. Suppression du bruit.

IMPORTANT :

Les zones importantes doivent être cohérentes.

Évite les pixels isolés inutiles.

Évite les changements de couleur aléatoires.

Les contours doivent être lisibles.

Le fond doit rester simple lorsqu'il n'est pas important.

Le patron doit être esthétique même avec un nombre limité de couleurs.

FORMAT OBLIGATOIRE :

Réponds uniquement avec un JSON valide.

{
  "palette": [
    "#000000"
  ],
  "grid": [
    [0,1,1]
  ]
}

La palette doit contenir exactement ${colors} couleurs.

La grille doit contenir exactement ${height} lignes.

Chaque ligne doit contenir exactement ${width} nombres.

Chaque nombre doit être compris entre 0 et ${colors - 1}.

Aucun texte avant ou après le JSON.
`;
}


/* ============================================================
   VALIDATION
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
        "Structure absente."
    };
  }


  if (
    data.palette.length !== colors
  ) {

    return {
      valid: false,
      error:
        "Nombre de couleurs incorrect."
    };
  }


  if (
    data.grid.length !== height
  ) {

    return {
      valid: false,
      error:
        "Nombre de lignes incorrect."
    };
  }


  const palette =
    data.palette.map(
      normalizeHex
    );


  if (
    palette.some(
      color => !color
    )
  ) {

    return {
      valid: false,
      error:
        "Palette invalide."
    };
  }


  for (
    let y = 0;
    y < height;
    y++
  ) {

    if (
      !Array.isArray(
        data.grid[y]
      )
    ) {

      return {
        valid: false,
        error:
          "Ligne de grille invalide."
      };
    }


    if (
      data.grid[y].length !== width
    ) {

      return {
        valid: false,
        error:
          "Largeur de grille incorrecte."
      };
    }


    for (
      let x = 0;
      x < width;
      x++
    ) {

      const value =
        Number(
          data.grid[y][x]
        );


      if (
        !Number.isInteger(value) ||
        value < 0 ||
        value >= colors
      ) {

        return {
          valid: false,
          error:
            "Valeur de grille invalide."
        };
      }


      data.grid[y][x] =
        value;
    }
  }


  return {
    valid: true,
    palette,
    grid: data.grid
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
