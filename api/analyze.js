export default async function handler(req, res) {

  // ============================================================
  // 1. MÉTHODE HTTP
  // ============================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  try {

    // ============================================================
    // 2. RÉCUPÉRATION DES DONNÉES
    // ============================================================

    const {
      image,
      width,
      height,
      colors
    } = req.body || {};

    const W = Number(width);
    const H = Number(height);
    const C = Number(colors);

    // ============================================================
    // 3. VÉRIFICATIONS
    // ============================================================

    if (!image) {
      return res.status(400).json({
        error: "Aucune image reçue."
      });
    }

    if (!Number.isInteger(W) || W < 1 || W > 120) {
      return res.status(400).json({
        error: "Largeur invalide."
      });
    }

    if (!Number.isInteger(H) || H < 1 || H > 120) {
      return res.status(400).json({
        error: "Hauteur invalide."
      });
    }

    if (!Number.isInteger(C) || C < 2 || C > 12) {
      return res.status(400).json({
        error: "Nombre de couleurs invalide."
      });
    }

    // ============================================================
    // 4. CLÉ API
    // ============================================================

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "La clé API OpenAI n'est pas configurée."
      });
    }

    // ============================================================
    // 5. PROMPT DE L'IA
    // ============================================================

    const prompt = `
Tu es le moteur intelligent d'une application qui transforme
une image en patron de TAPISSERIE AU CROCHET.

Tu dois analyser l'image visuellement et reconstruire son motif
principal sous forme d'une grille de mailles.

IMPORTANT :

Il ne faut PAS faire une simple moyenne de pixels.

Il faut comprendre l'image.

Tu dois identifier notamment :

- le sujet principal ;
- les silhouettes ;
- les formes importantes ;
- les contours ;
- les lettres ou textes éventuellement présents ;
- les symboles ;
- les détails visuels caractéristiques ;
- les espaces négatifs importants ;
- les positions relatives ;
- les proportions ;
- les contrastes essentiels.

Le but est que le patron final reste RECONNAISSABLE.

Tu peux simplifier les petits détails, mais tu dois préserver
les éléments visuellement importants.

PARAMÈTRES EXACTS DU PATRON :

Largeur : ${W} mailles
Hauteur : ${H} mailles
Nombre maximum de couleurs : ${C}

RÈGLES ABSOLUES POUR LA GRILLE :

- Il doit y avoir EXACTEMENT ${H} lignes.
- Chaque ligne doit contenir EXACTEMENT ${W} cases.
- Chaque case correspond à UNE maille.
- Une case contient uniquement un numéro de couleur.
- Les numéros commencent à 0.
- Les numéros autorisés vont de 0 à ${C - 1}.
- Il ne doit jamais y avoir de numéro supérieur ou égal à ${C}.
- La grille doit représenter le motif principal de l'image.
- Ne remplis pas artificiellement toute l'image avec une couleur.
- Préserve les contours et les espaces négatifs importants.

IMPORTANT POUR LA SORTIE :

Pour économiser de la place, la grille doit être fournie sous
forme de chaînes de caractères.

Exemple pour une largeur de 5 :

"00120"

Chaque caractère représente une case.

Donc :

"00120"

signifie :

[0, 0, 1, 2, 0]

Tu dois produire exactement ${H} chaînes.

Chaque chaîne doit avoir exactement ${W} caractères.

Ne mets aucun espace dans les chaînes.

La palette doit contenir exactement les couleurs réellement
utilisées dans la grille, avec au maximum ${C} couleurs.

Les couleurs doivent être des codes HEX.

Analyse d'abord l'image, puis construis le patron.

La reconnaissance du motif est prioritaire sur les détails
photographiques.
`;

    // ============================================================
    // 6. SCHÉMA JSON STRICT
    // ============================================================

    const schema = {
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
            type: "string"
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
    };

    // ============================================================
    // 7. APPEL OPENAI
    // ============================================================

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

          max_output_tokens: Math.max(
            12000,
            Math.min(30000, W * H + 5000)
          ),

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
              schema: schema
            }
          }

        })
      }
    );

    // ============================================================
    // 8. GESTION DES ERREURS OPENAI
    // ============================================================

    if (!response.ok) {

      const errorText = await response.text();

      let errorMessage = errorText;

      try {
        const errorJson = JSON.parse(errorText);

        if (errorJson?.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (_) {
        // On garde le texte original
      }

      return res.status(response.status).json({
        error: `OpenAI : ${errorMessage}`
      });
    }

    // ============================================================
    // 9. RÉCUPÉRATION DU TEXTE
    // ============================================================

    const data = await response.json();

    let outputText = "";

    if (typeof data.output_text === "string") {
      outputText = data.output_text;
    }

    // Sécurité supplémentaire si output_text n'est pas présent
    if (!outputText && Array.isArray(data.output)) {

      for (const item of data.output) {

        if (item.type !== "message") {
          continue;
        }

        if (!Array.isArray(item.content)) {
          continue;
        }

        for (const content of item.content) {

          if (
            content.type === "output_text" &&
            typeof content.text === "string"
          ) {
            outputText += content.text;
          }

        }
      }
    }

    if (!outputText) {
      return res.status(500).json({
        error: "OpenAI n'a renvoyé aucun résultat exploitable."
      });
    }

    // ============================================================
    // 10. PARSING JSON
    // ============================================================

    let result;

    try {

      result = JSON.parse(outputText);

    } catch (error) {

      // Tentative de récupération si jamais du texte parasite
      // se trouve autour du JSON.

      const firstBrace = outputText.indexOf("{");
      const lastBrace = outputText.lastIndexOf("}");

      if (firstBrace === -1 || lastBrace === -1) {

        return res.status(500).json({
          error: "L'IA a répondu, mais son résultat n'est pas un JSON valide."
        });

      }

      try {

        const cleaned = outputText.slice(
          firstBrace,
          lastBrace + 1
        );

        result = JSON.parse(cleaned);

      } catch (_) {

        return res.status(500).json({
          error: "L'IA a répondu, mais son résultat JSON est illisible."
        });

      }
    }

    // ============================================================
    // 11. VÉRIFICATION DE LA PALETTE
    // ============================================================

    if (!Array.isArray(result.palette)) {

      return res.status(500).json({
        error: "La palette générée est invalide."
      });
    }

    if (
      result.palette.length < 1 ||
      result.palette.length > C
    ) {

      return res.status(500).json({
        error: `La palette contient ${result.palette.length} couleurs au lieu de ${C} maximum.`
      });
    }

    // ============================================================
    // 12. VÉRIFICATION DE LA GRILLE
    // ============================================================

    if (!Array.isArray(result.grid)) {

      return res.status(500).json({
        error: "La grille générée est invalide."
      });
    }

    // EXACTEMENT H LIGNES
    if (result.grid.length !== H) {

      return res.status(500).json({
        error: `La grille contient ${result.grid.length} lignes au lieu de ${H}.`
      });
    }

    // ============================================================
    // 13. CONVERSION DES CHAÎNES EN TABLEAU DE NOMBRES
    // ============================================================

    const finalGrid = [];

    for (let y = 0; y < H; y++) {

      const row = result.grid[y];

      if (typeof row !== "string") {

        return res.status(500).json({
          error: `La ligne ${y + 1} de la grille n'est pas valide.`
        });
      }

      // EXACTEMENT W CASES
      if (row.length !== W) {

        return res.status(500).json({
          error:
            `La ligne ${y + 1} contient ${row.length} cases au lieu de ${W}.`
        });
      }

      const numericRow = [];

      for (let x = 0; x < W; x++) {

        const value = Number(row[x]);

        if (
          !Number.isInteger(value) ||
          value < 0 ||
          value >= result.palette.length
        ) {

          return res.status(500).json({
            error:
              `Valeur de couleur invalide à la ligne ${y + 1}, case ${x + 1}.`
          });
        }

        numericRow.push(value);
      }

      finalGrid.push(numericRow);
    }

    // ============================================================
    // 14. VÉRIFICATION FINALE
    // ============================================================

    if (finalGrid.length !== H) {

      return res.status(500).json({
        error: "Erreur interne : hauteur de grille incorrecte."
      });
    }

    for (const row of finalGrid) {

      if (row.length !== W) {

        return res.status(500).json({
          error: "Erreur interne : largeur de grille incorrecte."
        });
      }
    }

    // ============================================================
    // 15. RÉPONSE À L'APPLICATION
    // ============================================================

    return res.status(200).json({

      success: true,

      width: W,

      height: H,

      colors: result.palette.length,

      description:
        typeof result.description === "string"
          ? result.description
          : "",

      elements:
        Array.isArray(result.elements)
          ? result.elements
          : [],

      palette: result.palette,

      grid: finalGrid

    });

  } catch (error) {

    console.error("Erreur serveur :", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Une erreur inattendue est survenue."
    });
  }
          }
