export default async function handler(req, res) {

  // =========================================
  // 1. Vérification de la méthode
  // =========================================

  if (req.method !== "POST") {

    return res.status(405).json({
      error: "Méthode non autorisée."
    });

  }


  try {

    // =========================================
    // 2. Récupération des données
    // =========================================

    const {
      image,
      width,
      height,
      colors
    } = req.body || {};


    // =========================================
    // 3. Vérifications
    // =========================================

    if (!image) {

      return res.status(400).json({
        error: "Aucune image reçue."
      });

    }


    if (!width || !height || !colors) {

      return res.status(400).json({
        error:
          "La largeur, la hauteur et le nombre de couleurs sont obligatoires."
      });

    }


    const patternWidth = Number(width);
    const patternHeight = Number(height);
    const numberOfColors = Number(colors);


    if (
      !Number.isInteger(patternWidth) ||
      !Number.isInteger(patternHeight) ||
      !Number.isInteger(numberOfColors)
    ) {

      return res.status(400).json({
        error:
          "Les dimensions et le nombre de couleurs doivent être des nombres entiers."
      });

    }


    if (
      patternWidth < 1 ||
      patternHeight < 1 ||
      numberOfColors < 1 ||
      numberOfColors > 20
    ) {

      return res.status(400).json({
        error:
          "Dimensions ou nombre de couleurs invalides."
      });

    }


    // =========================================
    // 4. Clé API
    // =========================================

    const apiKey =
      process.env.OPENAI_API_KEY;


    if (!apiKey) {

      return res.status(500).json({
        error:
          "La clé API OpenAI n'est pas configurée sur le serveur."
      });

    }


    // =========================================
    // 5. Prompt du cerveau IA
    // =========================================

    const prompt = `

Tu es le moteur intelligent d'une application
qui transforme une IMAGE en PATRON DE TAPISSERIE AU CROCHET.

Ta mission n'est PAS de simplement réduire ou pixeliser
l'image.

Tu dois COMPRENDRE l'image puis REDESSINER son contenu
important sous forme d'une grille de crochet.

PARAMÈTRES DEMANDÉS :

- largeur exacte : ${patternWidth} mailles
- hauteur exacte : ${patternHeight} mailles
- maximum ${numberOfColors} couleurs
- une case = une maille = une couleur

IMPORTANT :

Le résultat doit contenir exactement :

${patternHeight} lignes

et chaque ligne doit contenir exactement :

${patternWidth} cases.


=========================================
ANALYSE VISUELLE
=========================================

Commence par analyser l'image.

Identifie notamment :

- les éléments principaux ;
- les textes ;
- les lettres ;
- les logos ;
- les formes ;
- les silhouettes ;
- les contours ;
- les espaces négatifs ;
- les proportions ;
- les positions relatives ;
- les couleurs essentielles.


=========================================
REDESSIN
=========================================

Ensuite, imagine comment REDESSINER ces éléments
sur une grille de ${patternWidth} × ${patternHeight} mailles.

Le but principal est que le motif reste RECONNAISSABLE.

Tu peux :

- simplifier les détails ;
- épaissir les contours ;
- simplifier les courbes ;
- supprimer les détails minuscules ;
- renforcer les espaces négatifs ;
- modifier légèrement les proportions ;
- déplacer légèrement un élément pour qu'il reste lisible.


=========================================
CAS PARTICULIER : TEXTE ET LOGOS
=========================================

Si l'image contient du texte ou un logo,
leur RECONNAISSANCE est prioritaire.

Ne transforme pas automatiquement les lettres
en gros blocs de couleur.

Pour un mot ou un logo :

1. identifie sa forme générale ;
2. identifie les contours ;
3. identifie les espaces entre les lettres ;
4. conserve les proportions ;
5. simplifie les lettres pour qu'elles restent
   reconnaissables dans la grille.


=========================================
INTERDICTIONS
=========================================

NE FAIS PAS une simple moyenne des pixels.

NE transforme PAS automatiquement l'image
en un gros pâté de couleur.

NE sacrifie PAS un élément important simplement
parce qu'il est petit.

La reconnaissance du motif est plus importante
que la fidélité pixel par pixel.


=========================================
PALETTE
=========================================

Crée une palette contenant au maximum
${numberOfColors} couleurs.

Utilise des couleurs HEX au format :

#RRGGBB

Les indices utilisés dans la grille doivent
correspondre aux indices de cette palette.

La première couleur de la palette correspond
à l'indice 0.

La deuxième correspond à l'indice 1.

Et ainsi de suite.


=========================================
GRILLE
=========================================

La grille doit avoir exactement :

${patternHeight} lignes

Chaque ligne doit avoir exactement :

${patternWidth} nombres.

Chaque nombre doit être un indice de couleur
valide dans la palette.

Si la palette contient N couleurs,
les indices autorisés vont de 0 à N-1.


=========================================
OBJECTIF
=========================================

Imagine que cette grille va être réellement
crochetée par une personne.

Elle doit donc produire un motif lisible,
propre et reconnaissable.

Réponds uniquement avec le JSON demandé.

`;


    // =========================================
    // 6. Appel OpenAI
    // =========================================

    const response = await fetch(
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

          model: "gpt-5.6",

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


          // Pour éviter que le modèle
          // coupe la grille en cours de route.

          max_output_tokens: 12000,


          text: {

            format: {

              type: "json_schema",

              name: "crochet_pattern",

              strict: true,

              schema: {

                type: "object",

                properties: {

                  description: {

                    type: "string"

                  },


                  elements: {

                    type: "array",

                    items: {

                      type: "object",

                      properties: {

                        type: {

                          type: "string"

                        },

                        description: {

                          type: "string"

                        },

                        importance: {

                          type: "string"

                        }

                      },

                      required: [

                        "type",
                        "description",
                        "importance"

                      ],

                      additionalProperties: false

                    }

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

                  "description",
                  "elements",
                  "palette",
                  "grid"

                ],


                additionalProperties: false

              }

            }

          }

        })

      }
    );


    // =========================================
    // 7. Gestion détaillée des erreurs OpenAI
    // =========================================

    if (!response.ok) {

      const errorText =
        await response.text();


      console.error(
        "OPENAI ERROR:",
        errorText
      );


      let readableError =
        errorText;


      try {

        const parsedError =
          JSON.parse(errorText);


        if (
          parsedError &&
          parsedError.error
        ) {

          if (
            typeof parsedError.error === "string"
          ) {

            readableError =
              parsedError.error;

          }

          else if (
            parsedError.error.message
          ) {

            readableError =
              parsedError.error.message;

          }

        }

      }

      catch (e) {

        // La réponse n'était pas du JSON.
        // On conserve le texte brut.

      }


      return res.status(500).json({

        error:
          "OpenAI : " + readableError,

        details:
          errorText

      });

    }


    // =========================================
    // 8. Lecture de la réponse
    // =========================================

    const data =
      await response.json();


    console.log(
      "OPENAI RESPONSE RECEIVED"
    );


    const outputText =
      data.output_text ||
      data.output
        ?.flatMap(
          item => item.content || []
        )
        ?.find(
          item =>
            item.type === "output_text"
        )
        ?.text;


    if (!outputText) {

      console.error(
        "Réponse OpenAI complète :",
        JSON.stringify(data)
      );


      return res.status(500).json({

        error:
          "L'IA n'a renvoyé aucun résultat exploitable.",

        details:
          JSON.stringify(data)

      });

    }


    // =========================================
    // 9. Conversion JSON
    // =========================================

    let result;


    try {

      result =
        JSON.parse(outputText);

    }

    catch (jsonError) {

      console.error(
        "JSON IA invalide :",
        outputText
      );


      return res.status(500).json({

        error:
          "L'IA a répondu, mais son résultat n'est pas un JSON valide.",

        details:
          jsonError.message

      });

    }


    // =========================================
    // 10. Vérification de la palette
    // =========================================

    if (
      !Array.isArray(result.palette)
    ) {

      return res.status(500).json({

        error:
          "L'IA n'a pas renvoyé de palette."

      });

    }


    if (
      result.palette.length === 0
    ) {

      return res.status(500).json({

        error:
          "La palette générée est vide."

      });

    }


    if (
      result.palette.length >
      numberOfColors
    ) {

      return res.status(500).json({

        error:
          `L'IA a généré ${result.palette.length} couleurs au lieu de ${numberOfColors} maximum.`

      });

    }


    // =========================================
    // 11. Vérification de la grille
    // =========================================

    if (
      !Array.isArray(result.grid)
    ) {

      return res.status(500).json({

        error:
          "L'IA n'a pas renvoyé de grille."

      });

    }


    if (
      result.grid.length !==
      patternHeight
    ) {

      return res.status(500).json({

        error:
          `La grille contient ${result.grid.length} lignes au lieu de ${patternHeight}.`

      });

    }


    for (
      let y = 0;
      y < result.grid.length;
      y++
    ) {

      const row =
        result.grid[y];


      if (
        !Array.isArray(row)
      ) {

        return res.status(500).json({

          error:
            `La ligne ${y + 1} n'est pas valide.`

        });

      }


      if (
        row.length !== patternWidth
      ) {

        return res.status(500).json({

          error:
            `La ligne ${y + 1} contient ${row.length} cases au lieu de ${patternWidth}.`

        });

      }


      for (
        let x = 0;
        x < row.length;
        x++
      ) {

        const colorIndex =
          row[x];


        if (
          !Number.isInteger(colorIndex)
        ) {

          return res.status(500).json({

            error:
              `La case ${x + 1}, ligne ${y + 1} contient un indice de couleur invalide.`

          });

        }


        if (
          colorIndex < 0 ||
          colorIndex >= result.palette.length
        ) {

          return res.status(500).json({

            error:
              `Indice de couleur invalide à la case ${x + 1}, ligne ${y + 1}.`

          });

        }

      }

    }


    // =========================================
    // 12. Tout est bon
    // =========================================

    return res.status(200).json({

      description:
        result.description || "",

      elements:
        Array.isArray(result.elements)
          ? result.elements
          : [],

      palette:
        result.palette,

      grid:
        result.grid

    });


  }

  catch (error) {

    console.error(
      "SERVER ERROR:",
      error
    );


    return res.status(500).json({

      error:
        "Erreur serveur : " +
        (error.message ||
          "erreur inconnue"),

      details:
        error.stack ||
        error.message ||
        ""

    });

  }

}
