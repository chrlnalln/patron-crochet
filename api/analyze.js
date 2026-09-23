import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL =
  process.env.OPENAI_MODEL || "gpt-5.6-luna";


/* ============================================================
   SCHEMA : ANALYSE + PREMIER PATRON
   ============================================================ */

const analysisSchema = {

  type: "object",

  additionalProperties: false,

  properties: {

    analysis: {

      type: "object",

      additionalProperties: false,

      properties: {

        subject: {
          type: "string"
        },

        composition: {
          type: "string"
        },

        aspect_ratio: {
          type: "string"
        },

        important_elements: {
          type: "array",
          items: {
            type: "string"
          }
        },

        simplification_strategy: {
          type: "string"
        },

        background_strategy: {
          type: "string"
        },

        crochet_notes: {
          type: "string"
        }

      },

      required: [
        "subject",
        "composition",
        "aspect_ratio",
        "important_elements",
        "simplification_strategy",
        "background_strategy",
        "crochet_notes"
      ]

    },


    recommendations: {

      type: "object",

      additionalProperties: false,

      properties: {

        title: {
          type: "string"
        },

        description: {
          type: "string"
        },

        width: {
          type: "integer"
        },

        height: {
          type: "integer"
        },

        colors: {
          type: "integer"
        },

        min_colors: {
          type: "integer"
        },

        max_colors: {
          type: "integer"
        },

        dimension_options: {

          type: "array",

          items: {

            type: "object",

            additionalProperties: false,

            properties: {

              width: {
                type: "integer"
              },

              height: {
                type: "integer"
              }

            },

            required: [
              "width",
              "height"
            ]

          }

        }

      },

      required: [
        "title",
        "description",
        "width",
        "height",
        "colors",
        "min_colors",
        "max_colors",
        "dimension_options"
      ]

    },


    palette: {

      type: "array",

      items: {
        type: "string"
      }

    },


    grid: {

      type: "array",

      items: {

        type: "array",

        items: {
          type: "integer"
        }

      }

    }

  },

  required: [
    "analysis",
    "recommendations",
    "palette",
    "grid"
  ]

};


/* ============================================================
   SCHEMA : REGENERATION
   ============================================================ */

const generationSchema = {

  type: "object",

  additionalProperties: false,

  properties: {

    palette: {

      type: "array",

      items: {
        type: "string"
      }

    },

    grid: {

      type: "array",

      items: {

        type: "array",

        items: {
          type: "integer"
        }

      }

    }

  },

  required: [
    "palette",
    "grid"
  ]

};


/* ============================================================
   OUTILS
   ============================================================ */

function clamp(value, min, max) {

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return min;
  }

  return Math.max(
    min,
    Math.min(max, Math.round(n))
  );

}


function normalizeDimensions(options) {

  if (!Array.isArray(options)) {
    return [];
  }

  return options

    .filter(option => {

      return (
        Number.isInteger(option?.width) &&
        Number.isInteger(option?.height)
      );

    })

    .map(option => {

      /*
       * IMPORTANT :
       * On limite le premier patron à 60 mailles
       * maximum pour éviter une réponse énorme.
       */

      return {

        width: clamp(
          option.width,
          20,
          60
        ),

        height: clamp(
          option.height,
          20,
          60
        )

      };

    })

    .slice(0, 5);

}


function validateGrid(
  grid,
  width,
  height,
  paletteLength
) {

  if (
    !Array.isArray(grid) ||
    grid.length !== height
  ) {

    return false;

  }


  for (
    let y = 0;
    y < height;
    y++
  ) {

    const row = grid[y];

    if (
      !Array.isArray(row) ||
      row.length !== width
    ) {

      return false;

    }


    for (
      let x = 0;
      x < width;
      x++
    ) {

      const value = row[x];

      if (
        !Number.isInteger(value) ||
        value < 0 ||
        value >= paletteLength
      ) {

        return false;

      }

    }

  }


  return true;

}


/* ============================================================
   APPEL OPENAI
   ============================================================ */

async function callOpenAI({
  image,
  prompt,
  schema,
  name
}) {

  const response =
    await openai.chat.completions.create({

      model: MODEL,

      messages: [

        {

          role: "user",

          content: [

            {

              type: "text",

              text: prompt

            },

            {

              type: "image_url",

              image_url: {

                url: image,

                detail: "high"

              }

            }

          ]

        }

      ],

      response_format: {

        type: "json_schema",

        json_schema: {

          name,

          strict: true,

          schema

        }

      },

      /*
       * On laisse suffisamment de place pour
       * une grille jusqu'à 60 × 60.
       */

      max_tokens: 20000

    });


  const message =
    response.choices?.[0]?.message;


  if (!message) {

    throw new Error(
      "OpenAI n'a renvoyé aucun résultat."
    );

  }


  if (message.refusal) {

    throw new Error(
      "L'IA a refusé d'analyser cette image."
    );

  }


  if (!message.content) {

    throw new Error(
      "OpenAI a renvoyé une réponse vide."
    );

  }


  try {

    return JSON.parse(
      message.content
    );

  } catch (error) {

    throw new Error(
      "OpenAI a renvoyé un résultat qui n'est pas un JSON valide."
    );

  }

}


/* ============================================================
   API
   ============================================================ */

export default async function handler(
  req,
  res
) {

  if (req.method !== "POST") {

    return res
      .status(405)
      .json({
        error:
          "Méthode non autorisée."
      });

  }


  try {

    const body =
      req.body || {};


    const action =
      body.action || "analyze";

    const image =
      body.image;

    const width =
      body.width;

    const height =
      body.height;

    const colors =
      body.colors;

    const analysis =
      body.analysis;


    /* ========================================================
       VALIDATION IMAGE
       ======================================================== */

    if (
      !image ||
      typeof image !== "string" ||
      !image.startsWith("data:image/")
    ) {

      return res
        .status(400)
        .json({

          error:
            "Image invalide ou absente."

        });

    }


    /* ========================================================
       PREMIER APPEL
       ======================================================== */

    if (
      action === "analyze"
    ) {

      const result =
        await callOpenAI({

          image,

          name:
            "crochet_first_pattern",

          schema:
            analysisSchema,


          prompt: `

Tu es un expert de la transformation
d'images en motifs de tapestry crochet.

Tu dois analyser l'image puis produire
DIRECTEMENT une première proposition
de patron de crochet.

IMPORTANT :

L'utilisateur NE DOIT PAS voir ton analyse
interne détaillée.

L'analyse sert uniquement à construire
un meilleur premier patron.


============================================================
1. ANALYSE DE L'IMAGE
============================================================

Identifie :

- le sujet principal ;
- sa silhouette ;
- les éléments caractéristiques ;
- la composition ;
- le ratio largeur / hauteur ;
- les contrastes importants ;
- les éléments secondaires.


============================================================
2. INTERPRÉTATION CROCHET
============================================================

NE FAIS PAS une simple pixelisation
de la photographie.

Le patron doit être une interprétation
graphique du sujet.

Priorités :

1. reconnaissance du sujet ;
2. silhouette ;
3. contours ;
4. éléments caractéristiques ;
5. contrastes ;
6. détails secondaires uniquement
   lorsqu'ils sont réellement utiles.


Simplifie fortement les détails inutiles.

Simplifie également le fond.


============================================================
3. FORMAT
============================================================

Choisis toi-même le format initial.

Propose entre 3 et 5 formats cohérents
avec les proportions de l'image.

Chaque dimension doit être comprise
entre 20 et 60 mailles.

Si l'image est carrée :
→ privilégie des formats carrés.

Si l'image est portrait :
→ privilégie des formats portrait.

Si l'image est paysage :
→ privilégie des formats paysage.


Choisis ensuite UN format initial
parmi ces propositions.


============================================================
4. COULEURS
============================================================

Choisis toi-même le nombre de couleurs
du premier patron.

Utilise idéalement entre 4 et 10 couleurs.

Maximum :

12 couleurs.

Détermine également :

- min_colors ;
- max_colors.

Le nombre initial doit être compris
entre ces deux valeurs.


============================================================
5. PREMIER PATRON
============================================================

Génère maintenant la première grille.

La grille doit correspondre EXACTEMENT
aux dimensions initiales choisies.

La palette doit contenir EXACTEMENT
le nombre de couleurs choisi.

Chaque cellule de la grille doit être
un entier correspondant à l'index
d'une couleur de la palette.

Les index commencent à 0.


============================================================
6. QUALITÉ VISUELLE
============================================================

Le résultat doit être joli et lisible.

Ne cherche pas à conserver chaque détail
de la photographie.

Il vaut mieux avoir :

- une silhouette claire ;
- de grands aplats ;
- quelques détails caractéristiques ;

plutôt qu'une grille pleine de bruit.

Le premier résultat doit donner envie
à l'utilisateur de poursuivre.


============================================================
7. PALETTE
============================================================

Utilise uniquement des couleurs HEX
au format :

#RRGGBB

Les couleurs doivent être suffisamment
distinctes pour être réellement utilisables
en tapestry crochet.


Retourne uniquement le JSON correspondant
au schéma demandé.

`

        });


      const recommendations =
        result.recommendations;


      if (!recommendations) {

        throw new Error(
          "Les recommandations de l'IA sont absentes."
        );

      }


      /* ======================================================
         DIMENSIONS
         ====================================================== */

      let dimensions =
        normalizeDimensions(
          recommendations.dimension_options
        );


      if (!dimensions.length) {

        dimensions = [

          {

            width:
              clamp(
                recommendations.width,
                20,
                60
              ),

            height:
              clamp(
                recommendations.height,
                20,
                60
              )

          }

        ];

      }


      let selectedWidth =
        clamp(
          recommendations.width,
          20,
          60
        );


      let selectedHeight =
        clamp(
          recommendations.height,
          20,
          60
        );


      /*
       * Vérifie que le format initial
       * existe bien dans les propositions.
       */

      const matchingDimension =
        dimensions.find(
          option =>
            option.width === selectedWidth &&
            option.height === selectedHeight
        );


      if (!matchingDimension) {

        selectedWidth =
          dimensions[0].width;

        selectedHeight =
          dimensions[0].height;

      }


      recommendations.width =
        selectedWidth;

      recommendations.height =
        selectedHeight;

      recommendations.dimension_options =
        dimensions;


      /* ======================================================
         COULEURS
         ====================================================== */

      const selectedColors =
        clamp(
          recommendations.colors,
          4,
          12
        );


      recommendations.colors =
        selectedColors;


      recommendations.min_colors =
        clamp(
          recommendations.min_colors,
          2,
          selectedColors
        );


      recommendations.max_colors =
        clamp(
          recommendations.max_colors,
          selectedColors,
          12
        );


      /* ======================================================
         PALETTE
         ====================================================== */

      const palette =
        Array.isArray(result.palette)
          ? result.palette
          : [];


      if (
        palette.length !==
        selectedColors
      ) {

        throw new Error(
          `L'IA a créé ${palette.length} couleurs au lieu de ${selectedColors}.`
        );

      }


      /* ======================================================
         GRILLE
         ====================================================== */

      if (
        !validateGrid(
          result.grid,
          selectedWidth,
          selectedHeight,
          palette.length
        )
      ) {

        throw new Error(
          `La première grille n'est pas cohérente : elle devrait faire ${selectedWidth} × ${selectedHeight}.`
        );

      }


      /* ======================================================
         RÉPONSE
         ====================================================== */

      return res
        .status(200)
        .json({

          analysis:
            result.analysis,

          recommendations,

          palette,

          grid:
            result.grid

        });

    }


    /* ========================================================
       RÉGÉNÉRATION APRÈS PERSONNALISATION
       ======================================================== */

    if (
      action === "generate"
    ) {

      const w =
        clamp(
          width,
          20,
          120
        );


      const h =
        clamp(
          height,
          20,
          120
        );


      const c =
        clamp(
          colors,
          2,
          16
        );


      if (!analysis) {

        return res
          .status(400)
          .json({

            error:
              "L'analyse initiale est manquante."

          });

      }


      const result =
        await callOpenAI({

          image,

          name:
            "crochet_regenerated_pattern",

          schema:
            generationSchema,


          prompt: `

Crée une nouvelle version du patron
de tapestry crochet à partir de l'image.

Voici l'analyse interne précédente :

${JSON.stringify(analysis)}


PARAMÈTRES DEMANDÉS :

Largeur :
${w}

Hauteur :
${h}

Nombre de couleurs :
${c}


============================================================
RÈGLES
============================================================

La grille doit contenir EXACTEMENT :

${h} lignes

et chaque ligne doit contenir EXACTEMENT :

${w} cellules.


La palette doit contenir EXACTEMENT :

${c} couleurs.


Chaque cellule doit contenir uniquement
un entier compris entre 0 et ${c - 1}.


La palette doit utiliser uniquement
des couleurs HEX #RRGGBB.


============================================================
QUALITÉ
============================================================

Ne fais pas une simple pixelisation.

Recompose le motif pour les nouvelles
dimensions.

Conserve :

- la silhouette ;
- les contours ;
- les éléments caractéristiques ;
- les contrastes importants.


Supprime le bruit inutile.

Le résultat doit rester lisible
et réellement exploitable en tapestry crochet.


Retourne uniquement le JSON demandé.

`

        });


      if (
        !Array.isArray(result.palette) ||
        result.palette.length !== c
      ) {

        throw new Error(
          `L'IA a renvoyé ${result.palette?.length || 0} couleurs au lieu de ${c}.`
        );

      }


      if (
        !validateGrid(
          result.grid,
          w,
          h,
          result.palette.length
        )
      ) {

        throw new Error(
          `La grille générée n'est pas cohérente avec ${w} × ${h}.`
        );

      }


      return res
        .status(200)
        .json(result);

    }


    return res
      .status(400)
      .json({

        error:
          "Action inconnue : " +
          action

      });


  } catch (error) {

    console.error(
      "ERREUR API ANALYZE :",
      error
    );


    /*
     * TRÈS IMPORTANT :
     * on renvoie maintenant la vraie erreur
     * à l'application.
     */

    return res
      .status(500)
      .json({

        error:
          error?.message ||
          "Erreur inconnue du serveur.",

        details:
          process.env.NODE_ENV === "development"
            ? String(error)
            : undefined

      });

  }

}
