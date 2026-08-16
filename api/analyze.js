export default async function handler(req, res) {
  // On accepte uniquement les requêtes POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  try {
    const {
      image,
      width,
      height,
      colors
    } = req.body;

    // Vérifications de base
    if (!image) {
      return res.status(400).json({
        error: "Aucune image reçue."
      });
    }

    if (!width || !height || !colors) {
      return res.status(400).json({
        error: "Les dimensions et le nombre de couleurs sont obligatoires."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "La clé API OpenAI n'est pas configurée sur le serveur."
      });
    }

    const prompt = `
Tu es le cerveau d'une application qui transforme des images
en patrons de TAPISSERIE AU CROCHET.

IMPORTANT :
Tu ne dois PAS simplement pixeliser ou réduire l'image.

Tu dois COMPRENDRE l'image puis reconstruire ses éléments
importants dans une grille de crochet.

Contraintes :
- largeur exacte : ${width} mailles
- hauteur exacte : ${height} mailles
- maximum ${colors} couleurs
- une case = une maille = une couleur
- chaque ligne doit contenir exactement ${width} cases
- il doit y avoir exactement ${height} lignes

Analyse d'abord l'image.

Identifie :
- les éléments visuellement importants ;
- les textes et lettres ;
- les logos ;
- les formes ;
- les silhouettes ;
- les contours ;
- les espaces négatifs importants ;
- les positions relatives ;
- les proportions ;
- les couleurs essentielles.

Ensuite, imagine comment REDESSINER ces éléments
pour qu'ils restent reconnaissables avec seulement
${width} × ${height} mailles.

Tu as le droit de :
- simplifier ;
- épaissir les formes ;
- simplifier les courbes ;
- supprimer les détails minuscules ;
- préserver artificiellement les espaces importants ;
- ajuster légèrement les proportions.

Tu ne dois PAS :
- transformer l'image en simple moyenne de pixels ;
- créer un gros pâté de couleur ;
- sacrifier un élément essentiel simplement parce qu'il est petit.

La reconnaissance du motif est prioritaire sur la fidélité
pixel par pixel.

Réponds UNIQUEMENT avec le JSON demandé.
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
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

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: "Erreur OpenAI",
        details: errorText
      });
    }

    const data = await response.json();

    // Récupération du texte JSON produit par le modèle
    const outputText =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text;

    if (!outputText) {
      return res.status(500).json({
        error: "L'IA n'a renvoyé aucun résultat exploitable."
      });
    }

    const result = JSON.parse(outputText);

    // Vérification de la grille
    if (!Array.isArray(result.grid)) {
      return res.status(500).json({
        error: "L'IA n'a pas renvoyé de grille."
      });
    }

    if (result.grid.length !== Number(height)) {
      return res.status(500).json({
        error:
          `La grille contient ${result.grid.length} lignes au lieu de ${height}.`
      });
    }

    for (const row of result.grid) {
      if (
        !Array.isArray(row) ||
        row.length !== Number(width)
      ) {
        return res.status(500).json({
          error:
            `Une ligne de la grille ne contient pas ${width} mailles.`
        });
      }
    }

    return res.status(200).json(result);

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Erreur inattendue du serveur.",
      details: error.message
    });
  }
      }
