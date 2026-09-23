import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = "gpt-5.6-luna";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  try {

    const { image } = req.body || {};

    if (!image) {
      return res.status(400).json({
        error: "Aucune image reçue par l'API."
      });
    }

    console.log("IMAGE RECUE :", image.substring(0, 40));

    const response = await openai.chat.completions.create({

      model: MODEL,

      messages: [

        {
          role: "system",

          content: `
Tu es un expert du tapestry crochet.

Ta mission est de transformer une image
en un PREMIER PATRON DE TAPESTRY CROCHET.

Tu dois :

1. identifier le sujet principal ;
2. simplifier l'image ;
3. conserver sa silhouette et ses éléments
   les plus reconnaissables ;
4. supprimer les détails inutiles ;
5. créer une grille de 30 colonnes × 30 lignes ;
6. utiliser entre 4 et 8 couleurs ;
7. créer une palette de couleurs HEX ;
8. remplir chaque case de la grille avec
   l'index d'une couleur de la palette.

IMPORTANT :

Il ne faut PAS simplement transformer
chaque pixel de l'image en une case.

Il faut créer une véritable interprétation
graphique adaptée au tapestry crochet.

Le résultat doit être lisible,
simple et reconnaissable.

Retourne UNIQUEMENT le JSON demandé.
`
        },

        {
          role: "user",

          content: [

            {
              type: "text",

              text:
                "Analyse cette image et crée le premier patron."
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

          name: "crochet_pattern",

          strict: true,

          schema: {

            type: "object",

            additionalProperties: false,

            properties: {

              subject: {
                type: "string"
              },

              width: {
                type: "integer"
              },

              height: {
                type: "integer"
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
              "subject",
              "width",
              "height",
              "palette",
              "grid"
            ]

          }

        }

      },

      max_completion_tokens: 16000

    });


    console.log(
      "REPONSE OPENAI RECUE"
    );


    const choice =
      response.choices?.[0];

    if (!choice) {

      throw new Error(
        "OpenAI n'a renvoyé aucun choix."
      );

    }


    if (
      choice.message?.refusal
    ) {

      throw new Error(
        "OpenAI a refusé l'analyse : " +
        choice.message.refusal
      );

    }


    const content =
      choice.message?.content;


    if (!content) {

      throw new Error(
        "OpenAI a renvoyé une réponse vide."
      );

    }


    let result;

    try {

      result =
        JSON.parse(content);

    } catch (error) {

      console.error(
        "JSON OPENAI :",
        content
      );

      throw new Error(
        "La réponse d'OpenAI n'est pas un JSON valide."
      );

    }


    /* =====================================================
       VERIFICATIONS
       ===================================================== */

    if (
      result.width !== 30 ||
      result.height !== 30
    ) {

      throw new Error(
        "La grille générée n'est pas en 30 × 30."
      );

    }


    if (
      !Array.isArray(result.palette)
    ) {

      throw new Error(
        "La palette est absente."
      );

    }


    if (
      !Array.isArray(result.grid) ||
      result.grid.length !== 30
    ) {

      throw new Error(
        "La grille ne contient pas 30 lignes."
      );

    }


    for (
      let y = 0;
      y < 30;
      y++
    ) {

      if (
        !Array.isArray(result.grid[y]) ||
        result.grid[y].length !== 30
      ) {

        throw new Error(
          `La ligne ${y + 1} de la grille n'a pas 30 cases.`
        );

      }

    }


    console.log(
      "PATRON VALIDE"
    );


    return res.status(200).json({

      subject:
        result.subject,

      width:
        result.width,

      height:
        result.height,

      palette:
        result.palette,

      grid:
        result.grid

    });


  } catch (error) {

    console.error(
      "ERREUR COMPLETE :",
      error
    );


    return res.status(500).json({

      error:
        error?.message ||
        "Erreur inconnue dans api/analyze.js"

    });

  }

}
