export default async function handler(req, res) {

  // ============================================================
  // V4.4 — PATRON CROCHET AI
  // Compréhension du sujet + intention utilisateur
  // ============================================================

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
      colors,
      description: userDescription
    } = req.body || {};

    const W = Number(width);
    const H = Number(height);
    const C = Number(colors);

    const descriptionUtilisateur =
      typeof userDescription === "string"
        ? userDescription.trim().slice(0, 1000)
        : "";

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
    // 5. DESCRIPTION UTILISATEUR
    // ============================================================

    const intention = descriptionUtilisateur
      ? `
============================================================
INTENTION DE LA PERSONNE
============================================================

La personne a décrit ce qu'elle souhaite retrouver dans
son patron :

"${descriptionUtilisateur}"

Cette information est TRÈS IMPORTANTE.

La description de la personne doit être utilisée pour
déterminer ce qui constitue le sujet principal du patron.

Si la photo contient beaucoup d'éléments secondaires
(arrière-plan, meubles, décorations, personnes, objets,
etc.), ne leur donne pas la priorité si la personne ne
demande pas de les représenter.

Tu dois comprendre la différence entre :

- ce qui est présent dans la photographie ;
- ce que la personne souhaite réellement transformer
  en motif de tapisserie au crochet.

La description utilisateur ne doit cependant pas te faire
inventer des éléments absents de la photographie.

Tu dois donc CROISER :
1. ce que tu vois réellement dans l'image ;
2. ce que la personne demande de représenter.

Le résultat doit correspondre aux deux.
`
      : `
============================================================
AUCUNE DESCRIPTION UTILISATEUR
============================================================

La personne n'a fourni aucune description.

Dans ce cas, analyse toi-même l'image et identifie le sujet
principal le plus évident.

Ne te laisse pas distraire par les éléments secondaires
de l'arrière-plan.
`;

    // ============================================================
    // 6. PROMPT PRINCIPAL
    // ============================================================

    const prompt = `
Tu es le moteur intelligent d'une application qui transforme
une image en patron de TAPISSERIE AU CROCHET.

Ton objectif n'est PAS de pixeliser simplement une photographie.

Ton objectif est de comprendre ce que la personne veut
représenter et de REDESSINER ce sujet sous forme d'une grille
de mailles de crochet.

${intention}

============================================================
PRINCIPE ABSOLU
============================================================

Le patron final doit être reconnaissable par une personne
qui regarde le patron sans avoir besoin de voir la photographie.

La RECONNAISSANCE DU SUJET PRINCIPAL est prioritaire sur :

- les détails photographiques ;
- les textures ;
- les ombres ;
- les petits objets secondaires ;
- la fidélité pixel par pixel.

============================================================
ANALYSE DE L'IMAGE
============================================================

Analyse d'abord attentivement la photographie.

Identifie notamment :

- le sujet principal ;
- sa silhouette ;
- sa forme générale ;
- ses contours ;
- ses proportions ;
- son orientation ;
- les parties caractéristiques ;
- les éléments qui permettent de l'identifier ;
- les espaces négatifs importants ;
- les couleurs essentielles ;
- les éventuels textes ;
- les éventuels symboles ;
- les éléments secondaires ;
- l'arrière-plan.

Tu dois déterminer ce qui doit absolument être conservé
dans une représentation très simplifiée.

============================================================
HIÉRARCHISATION
============================================================

Classe mentalement les éléments ainsi :

PRIORITÉ 1 :
Le sujet demandé par l'utilisateur.

PRIORITÉ 2 :
Les caractéristiques permettant de reconnaître ce sujet.

PRIORITÉ 3 :
Les couleurs et détails importants.

PRIORITÉ 4 :
Les éléments secondaires réellement utiles.

PRIORITÉ 5 :
Les détails photographiques non essentiels.

Si la résolution est insuffisante pour tout conserver,
sacrifie les détails secondaires AVANT les caractéristiques
du sujet principal.

============================================================
SIMPLIFICATION POUR LE CROCHET
============================================================

Tu as le droit de :

- simplifier les formes ;
- épaissir légèrement les contours ;
- simplifier les courbes ;
- supprimer les petits détails ;
- renforcer les contrastes ;
- préserver artificiellement les espaces négatifs ;
- ajuster légèrement les proportions ;
- simplifier les textures ;
- rendre certaines parties légèrement plus grandes
  si cela permet de conserver la reconnaissance du motif.

Tu ne dois PAS :

- faire une simple moyenne de pixels ;
- produire une forme abstraite ;
- transformer tout le sujet en un gros pâté de couleur ;
- donner trop d'importance à l'arrière-plan ;
- supprimer une partie essentielle du sujet uniquement
  parce qu'elle est petite ;
- inventer des éléments qui ne sont pas présents.

============================================================
AUTO-VÉRIFICATION AVANT RÉPONSE
============================================================

Avant de produire la grille finale, vérifie mentalement :

1. Quel est le sujet principal demandé ?
2. Est-il réellement présent dans la photographie ?
3. La silhouette du sujet est-elle reconnaissable ?
4. Ses caractéristiques principales sont-elles conservées ?
5. Les éléments secondaires prennent-ils trop de place ?
6. La grille ressemble-t-elle davantage au sujet demandé
   qu'à une simple répartition de pixels ?
7. La composition générale correspond-elle à la photographie ?
8. Les proportions sont-elles cohérentes ?
9. Le nombre de couleurs est-il respecté ?
10. La grille respecte-t-elle exactement les dimensions demandées ?

Si quelque chose ne correspond pas au sujet principal,
CORRIGE LA GRILLE AVANT DE RÉPONDRE.

============================================================
PARAMÈTRES EXACTS DU PATRON
============================================================

Largeur : ${W} mailles
Hauteur : ${H} mailles
Nombre maximum de couleurs : ${C}

============================================================
RÈGLES ABSOLUES DE LA GRILLE
============================================================

- Il doit y avoir EXACTEMENT ${H} lignes.
- Chaque ligne doit contenir EXACTEMENT ${W} cases.
- Chaque case correspond à UNE maille.
- Une case contient uniquement un numéro de couleur.
- Les numéros commencent à 0.
- Les numéros autorisés vont de 0 à ${C - 1}.
- Aucun numéro ne doit être supérieur ou égal à ${C}.

Pour économiser de la place, la grille doit être fournie
sous forme de chaînes de caractères.

Exemple pour une largeur de 5 :

"00120"

Cela signifie :

[0, 0, 1, 2, 0]

Tu dois produire exactement ${H} chaînes.

Chaque chaîne doit contenir exactement ${W} caractères.

Ne mets aucun espace dans les chaînes.

============================================================
PALETTE
============================================================

La palette doit contenir uniquement les couleurs réellement
utilisées dans la grille.

Maximum ${C} couleurs.

Toutes les couleurs doivent être fournies sous forme de codes HEX.

============================================================
SORTIE
============================================================

Réponds uniquement avec le JSON demandé par le schéma.

Aucun texte avant ou après le JSON.
`;

    // ============================================================
    // 7. SCHÉMA JSON STRICT
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
    // 8. APPEL OPENAI
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

          max_output_tokens:
            Math.max(
              12000,
              Math.min(
                30000,
                W * H + 5000
              )
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
    // 9. GESTION DES ERREURS OPENAI
    // ============================================================

    if (!response.ok) {

      const errorText =
        await response.text();

      let errorMessage =
        errorText;

      try {

        const errorJson =
          JSON.parse(errorText);

        if (
          errorJson?.error?.message
        ) {

          errorMessage =
            errorJson.error.message;

        }

      } catch (_) {
        // On conserve le message original
      }

      return res.status(response.status).json({

        error:
          `OpenAI : ${errorMessage}`

      });

    }

    // ============================================================
    // 10. RÉCUPÉRATION DE LA RÉPONSE
    // ============================================================

    const data =
      await response.json();

    let outputText = "";

    if (
      typeof data.output_text === "string"
    ) {

      outputText =
        data.output_text;

    }

    if (
      !outputText &&
      Array.isArray(data.output)
    ) {

      for (
        const item of data.output
      ) {

        if (
          item.type !== "message"
        ) {
          continue;
        }

        if (
          !Array.isArray(item.content)
        ) {
          continue;
        }

        for (
          const content of item.content
        ) {

          if (
            content.type === "output_text" &&
            typeof content.text === "string"
          ) {

            outputText +=
              content.text;

          }

        }

      }

    }

    if (!outputText) {

      return res.status(500).json({

        error:
          "OpenAI n'a renvoyé aucun résultat exploitable."

      });

    }

    // ============================================================
    // 11. PARSING JSON
    // ============================================================

    let result;

    try {

      result =
        JSON.parse(outputText);

    } catch (error) {

      const firstBrace =
        outputText.indexOf("{");

      const lastBrace =
        outputText.lastIndexOf("}");

      if (
        firstBrace === -1 ||
        lastBrace === -1
      ) {

        return res.status(500).json({

          error:
            "L'IA a répondu, mais son résultat n'est pas un JSON valide."

        });

      }

      try {

        const cleaned =
          outputText.slice(
            firstBrace,
            lastBrace + 1
          );

        result =
          JSON.parse(cleaned);

      } catch (_) {

        return res.status(500).json({

          error:
            "L'IA a répondu, mais son résultat JSON est illisible."

        });

      }

    }

    // ============================================================
    // 12. VÉRIFICATION PALETTE
    // ============================================================

    if (
      !Array.isArray(result.palette)
    ) {

      return res.status(500).json({

        error:
          "La palette générée est invalide."

      });

    }

    if (
      result.palette.length < 1 ||
      result.palette.length > C
    ) {

      return res.status(500).json({

        error:
          `La palette contient ${result.palette.length} couleurs au lieu de ${C} maximum.`

      });

    }

    // ============================================================
    // 13. VÉRIFICATION GRILLE
    // ============================================================

    if (
      !Array.isArray(result.grid)
    ) {

      return res.status(500).json({

        error:
          "La grille générée est invalide."

      });

    }

    if (
      result.grid.length !== H
    ) {

      return res.status(500).json({

        error:
          `La grille contient ${result.grid.length} lignes au lieu de ${H}.`

      });

    }

    // ============================================================
    // 14. CONVERSION DES CHAÎNES EN TABLEAU
    // ============================================================

    const finalGrid = [];

    for (
      let y = 0;
      y < H;
      y++
    ) {

      const row =
        result.grid[y];

      if (
        typeof row !== "string"
      ) {

        return res.status(500).json({

          error:
            `La ligne ${y + 1} de la grille n'est pas valide.`

        });

      }

      if (
        row.length !== W
      ) {

        return res.status(500).json({

          error:
            `La ligne ${y + 1} contient ${row.length} cases au lieu de ${W}.`

        });

      }

      const numericRow = [];

      for (
        let x = 0;
        x < W;
        x++
      ) {

        const value =
          Number(row[x]);

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

      finalGrid.push(
        numericRow
      );

    }

    // ============================================================
    // 15. VÉRIFICATION FINALE
    // ============================================================

    if (
      finalGrid.length !== H
    ) {

      return res.status(500).json({

        error:
          "Erreur interne : hauteur de grille incorrecte."

      });

    }

    for (
      const row of finalGrid
    ) {

      if (
        row.length !== W
      ) {

        return res.status(500).json({

          error:
            "Erreur interne : largeur de grille incorrecte."

        });

      }

    }

    // ============================================================
    // 16. RÉPONSE À L'APPLICATION
    // ============================================================

    return res.status(200).json({

      success: true,

      version: "4.4",

      width: W,

      height: H,

      colors:
        result.palette.length,

      description:
        typeof result.description === "string"
          ? result.description
          : "",

      userDescription:
        descriptionUtilisateur,

      elements:
        Array.isArray(result.elements)
          ? result.elements
          : [],

      palette:
        result.palette,

      grid:
        finalGrid

    });

  } catch (error) {

    console.error(
      "Erreur serveur :",
      error
    );

    return res.status(500).json({

      error:
        error?.message ||
        "Une erreur inattendue est survenue."

    });

  }

}
