export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    const {
      image,
      width,
      height,
      colors,
      description: userDescription
    } = req.body || {};

    const W = Number(width);
    const H = Number(height);
    const C = Number(colors);
    const description = typeof userDescription === "string"
      ? userDescription.trim().slice(0, 1000)
      : "";

    if (!image) {
      return res.status(400).json({ error: "Aucune image reçue." });
    }

    if (!Number.isInteger(W) || W < 1 || W > 120) {
      return res.status(400).json({
        error: "Largeur invalide. Maximum : 120 mailles."
      });
    }

    if (!Number.isInteger(H) || H < 1 || H > 120) {
      return res.status(400).json({
        error: "Hauteur invalide. Maximum : 120 mailles."
      });
    }

    if (!Number.isInteger(C) || C < 2 || C > 12) {
      return res.status(400).json({
        error: "Nombre de couleurs invalide. Choisis entre 2 et 12 couleurs."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "La clé API OpenAI n'est pas configurée sur Vercel."
      });
    }

    const intention = description
      ? `
INTENTION DE L'UTILISATEUR :

"${description}"

Cette phrase est une information prioritaire.

Tu dois croiser cette intention avec ce que tu vois réellement
dans la photographie.

La personne indique ce qu'elle veut retrouver dans le patron.
Si elle demande de représenter un sujet précis, concentre la
grille sur ce sujet et ignore autant que possible le décor
non demandé.

Ne jamais inventer un élément absent de la photo.
`
      : `
Aucune description n'a été fournie.

Identifie toi-même le sujet principal le plus évident de la photo
et donne-lui la priorité.
`;

    const prompt = `
Tu es le moteur d'une application qui transforme des photos en
patrons de TAPISSERIE AU CROCHET.

OBJECTIF :

Produire une grille de crochet reconnaissable, et non une simple
pixelisation de la photographie.

${intention}

ANALYSE D'ABORD L'IMAGE :

Identifie :
- le sujet principal ;
- sa silhouette et ses contours ;
- les proportions ;
- l'orientation ;
- les parties caractéristiques ;
- les espaces négatifs importants ;
- les couleurs essentielles ;
- les éventuels textes, lettres ou symboles ;
- les éléments secondaires et l'arrière-plan.

HIÉRARCHIE :

1. Sujet demandé par l'utilisateur.
2. Caractéristiques qui permettent de reconnaître ce sujet.
3. Couleurs et détails importants.
4. Éléments secondaires utiles.
5. Détails photographiques non essentiels.

Si la résolution est insuffisante, supprime les détails secondaires
avant de supprimer les caractéristiques du sujet principal.

SIMPLIFICATION POUR LE CROCHET :

Tu peux simplifier les courbes, renforcer légèrement les contours,
supprimer les petits détails, préserver les espaces négatifs et
ajuster légèrement les proportions pour conserver la lisibilité.

Tu ne dois PAS :
- faire une moyenne de pixels sans comprendre le sujet ;
- produire une forme abstraite ;
- créer un gros pâté de couleur ;
- donner au décor plus d'importance qu'au sujet demandé ;
- supprimer une caractéristique essentielle du sujet ;
- inventer un élément absent de la photo.

AUTO-VÉRIFICATION AVANT DE RÉPONDRE :

Avant de produire le JSON final, vérifie :
- que le sujet demandé est réellement présent ;
- que sa silhouette est reconnaissable ;
- que ses caractéristiques principales sont conservées ;
- que le décor ne prend pas trop de place ;
- que la composition correspond à la photo ;
- que les proportions sont cohérentes ;
- que la palette respecte le nombre maximum de couleurs ;
- que la grille a exactement la largeur et la hauteur demandées.

Si cette vérification échoue, corrige mentalement la grille avant
de répondre.

PARAMÈTRES EXACTS :

Largeur : ${W} mailles.
Hauteur : ${H} mailles.
Maximum : ${C} couleurs.

RÈGLES DE GRILLE :

- exactement ${H} lignes ;
- exactement ${W} cases par ligne ;
- une case = une maille = une couleur ;
- les couleurs sont référencées par un chiffre de 0 à ${C - 1} ;
- chaque ligne est une chaîne ;
- exemple largeur 5 : "00120" = [0,0,1,2,0] ;
- aucun espace dans les chaînes ;
- la palette contient uniquement les couleurs réellement utilisées ;
- les couleurs de la palette sont des codes HEX.

Réponds UNIQUEMENT avec le JSON correspondant au schéma.
`;

    const schema = {
      type: "object",
      properties: {
        description: { type: "string" },
        elements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              description: { type: "string" },
              importance: { type: "string" }
            },
            required: ["type", "description", "importance"],
            additionalProperties: false
          }
        },
        palette: {
          type: "array",
          items: { type: "string" }
        },
        grid: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["description", "elements", "palette", "grid"],
      additionalProperties: false
    };

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
          input: [{
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
          }],
          text: {
            format: {
              type: "json_schema",
              name: "crochet_pattern",
              strict: true,
              schema
            }
          }
        })
      }
    );

    if (!response.ok) {
      const raw = await response.text();

      let message = raw;

      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error?.message) {
          message = parsed.error.message;
        }
      } catch {}

      return res.status(response.status).json({
        error: `OpenAI : ${message}`
      });
    }

    const data = await response.json();

    let outputText =
      typeof data.output_text === "string"
        ? data.output_text
        : "";

    if (!outputText && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (
          item.type !== "message" ||
          !Array.isArray(item.content)
        ) {
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

    let result;

    try {
      result = JSON.parse(outputText);
    } catch {
      const start = outputText.indexOf("{");
      const end = outputText.lastIndexOf("}");

      if (start === -1 || end === -1) {
        return res.status(500).json({
          error:
            "L'IA a répondu, mais son résultat n'est pas un JSON valide."
        });
      }

      try {
        result = JSON.parse(
          outputText.slice(start, end + 1)
        );
      } catch {
        return res.status(500).json({
          error:
            "L'IA a répondu, mais son résultat JSON est illisible."
        });
      }
    }

    if (
      !Array.isArray(result.palette) ||
      result.palette.length < 1 ||
      result.palette.length > C
    ) {
      return res.status(500).json({
        error: "La palette générée est invalide."
      });
    }

    if (
      !Array.isArray(result.grid) ||
      result.grid.length !== H
    ) {
      return res.status(500).json({
        error:
          `La grille contient ${
            Array.isArray(result.grid)
              ? result.grid.length
              : 0
          } lignes au lieu de ${H}.`
      });
    }

    const finalGrid = [];

    for (let y = 0; y < H; y++) {
      const row = result.grid[y];

      if (
        typeof row !== "string" ||
        row.length !== W
      ) {
        return res.status(500).json({
          error:
            `La ligne ${y + 1} contient ${
              typeof row === "string"
                ? row.length
                : 0
            } cases au lieu de ${W}.`
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
              `Valeur de couleur invalide à la ligne ${
                y + 1
              }, case ${x + 1}.`
          });
        }

        numericRow.push(value);
      }

      finalGrid.push(numericRow);
    }

    return res.status(200).json({
      success: true,
      version: "4.4.1",
      width: W,
      height: H,
      colors: result.palette.length,
      description: result.description || "",
      userDescription: description,
      elements: Array.isArray(result.elements)
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
