import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL =
  process.env.OPENAI_MODEL ||
  "gpt-5.6-luna";


/* ==================================================
   SCHEMA ANALYSE
   ================================================== */

const analysisSchema = {

  type: "object",

  additionalProperties: false,

  properties: {

    analysis: {

      type: "object",

      additionalProperties: false,

      properties: {

        subject:{
          type:"string"
        },

        composition:{
          type:"string"
        },

        aspect_ratio:{
          type:"string"
        },

        important_elements:{
          type:"array",
          items:{
            type:"string"
          }
        },

        simplification_strategy:{
          type:"string"
        },

        background_strategy:{
          type:"string"
        },

        crochet_notes:{
          type:"string"
        }

      },

      required:[
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

      type:"object",

      additionalProperties:false,

      properties: {

        title:{
          type:"string"
        },

        description:{
          type:"string"
        },

        width:{
          type:"integer"
        },

        height:{
          type:"integer"
        },

        colors:{
          type:"integer"
        },

        min_colors:{
          type:"integer"
        },

        max_colors:{
          type:"integer"
        },

        dimension_options:{

          type:"array",

          items:{

            type:"object",

            additionalProperties:false,

            properties:{

              width:{
                type:"integer"
              },

              height:{
                type:"integer"
              }

            },

            required:[
              "width",
              "height"
            ]

          }

        }

      },

      required:[
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


    palette:{

      type:"array",

      items:{
        type:"string"
      }

    },


    grid:{

      type:"array",

      items:{

        type:"array",

        items:{
          type:"integer"
        }

      }

    }

  },


  required:[
    "analysis",
    "recommendations",
    "palette",
    "grid"
  ]

};


/* ==================================================
   SCHEMA GENERATION
   ================================================== */

const generationSchema = {

  type:"object",

  additionalProperties:false,

  properties:{

    palette:{

      type:"array",

      items:{
        type:"string"
      }

    },

    grid:{

      type:"array",

      items:{

        type:"array",

        items:{
          type:"integer"
        }

      }

    }

  },

  required:[
    "palette",
    "grid"
  ]

};


/* ==================================================
   OUTILS
   ================================================== */

function clamp(
  n,
  min,
  max
){

  return Math.max(
    min,
    Math.min(
      max,
      Number(n) || min
    )
  );

}


function normalizeDimensionOptions(
  recommendations
){

  const options =
    Array.isArray(
      recommendations.dimension_options
    )
      ? recommendations.dimension_options
      : [];


  return options

    .filter(
      option =>
        Number.isInteger(
          option.width
        ) &&
        Number.isInteger(
          option.height
        )
    )

    .map(
      option => ({

        width:
          clamp(
            option.width,
            20,
            120
          ),

        height:
          clamp(
            option.height,
            20,
            120
          )

      })
    )

    .slice(0,6);

}


function validateGrid(
  grid,
  width,
  height,
  paletteLength
){

  if(
    !Array.isArray(grid) ||
    grid.length !== height
  ){

    return false;

  }


  return grid.every(
    row =>

      Array.isArray(row) &&

      row.length === width &&

      row.every(
        value =>

          Number.isInteger(value) &&

          value >= 0 &&

          value < paletteLength

      )

  );

}


/* ==================================================
   APPEL IA
   ================================================== */

async function callVision({
  image,
  prompt,
  schema,
  name
}){

  const response =
    await openai.responses.create({

      model:MODEL,

      store:false,

      input:[{

        role:"user",

        content:[

          {
            type:"input_text",
            text:prompt
          },

          {
            type:"input_image",
            image_url:image,
            detail:"high"
          }

        ]

      }],

      text:{

        format:{

          type:"json_schema",

          name,

          strict:true,

          schema

        }

      }

    });


  if(
    !response.output_text
  ){

    throw new Error(
      "Réponse IA vide."
    );

  }


  return JSON.parse(
    response.output_text
  );

}


/* ==================================================
   API
   ================================================== */

export default async function handler(
  req,
  res
){

  if(
    req.method !== "POST"
  ){

    return res
      .status(405)
      .json({
        error:"Méthode non autorisée."
      });

  }


  try{

    const {

      action = "analyze",

      image,

      width,

      height,

      colors,

      analysis

    } = req.body || {};


    if(
      !image ||
      typeof image !== "string" ||
      !image.startsWith(
        "data:image/"
      )
    ){

      return res
        .status(400)
        .json({
          error:
            "Image invalide ou absente."
        });

    }


    /* ==================================================
       PREMIÈRE ANALYSE
       ================================================== */

    if(
      action === "analyze"
    ){

      const result =
        await callVision({

          image,

          name:
            "crochet_analysis",

          schema:
            analysisSchema,


          prompt:`

Tu es un expert de la transformation
d'images en patrons de tapestry crochet.

Ta mission est de transformer l'image fournie
en un PREMIER PATRON DE CROCHET réellement
lisible et exploitable.

IMPORTANT :

L'utilisateur ne verra PAS ton analyse détaillée.

Cette analyse sert uniquement de raisonnement
interne pour construire le premier patron.

Tu dois donc réfléchir précisément avant
de générer la grille.


==================================================
1. IDENTIFIER LE SUJET
==================================================

Identifie le sujet principal de l'image.

Détermine ce qui doit absolument être conservé
pour que le motif reste reconnaissable.

Ignore les détails secondaires qui ne sont
pas utiles au crochet.


==================================================
2. COMPOSITION
==================================================

Analyse :

- la forme générale ;
- la position du sujet ;
- les éléments importants ;
- le ratio largeur / hauteur ;
- les contrastes ;
- les zones de fond.


==================================================
3. SIMPLIFICATION POUR LE CROCHET
==================================================

NE FAIS PAS UNE SIMPLE PIXELISATION
DE LA PHOTOGRAPHIE.

Le premier patron doit ressembler à une
INTERPRÉTATION GRAPHIQUE du sujet.

Priorités :

1. silhouette reconnaissable ;
2. contours lisibles ;
3. éléments caractéristiques ;
4. contrastes importants ;
5. détails secondaires seulement si leur présence
   améliore réellement la reconnaissance.


Le fond doit être simplifié au maximum
lorsqu'il n'est pas important.


==================================================
4. DIMENSIONS
==================================================

Tu dois choisir toi-même les dimensions
du PREMIER patron.

Propose entre 3 et 6 formats.

Les formats doivent respecter le ratio
de l'image.

Si l'image est carrée :

→ privilégie des formats carrés.

Si elle est en portrait :

→ conserve un format portrait.

Si elle est en paysage :

→ conserve un format paysage.


Pour cette version :

minimum : 20 mailles

maximum : 120 mailles

Évite les formats inutilement grands.


Choisis également UNE dimension initiale
parmi les propositions.


==================================================
5. COULEURS
==================================================

Tu dois également choisir toi-même
le nombre de couleurs du PREMIER patron.

Choisis le nombre de couleurs en fonction
de la complexité réellement utile de l'image.

En général :

4 à 12 couleurs.

Maximum :

16 couleurs.


Détermine également :

- un nombre minimum réaliste ;
- un nombre maximum réaliste.


Le nombre initial doit être compris
entre le minimum et le maximum.


==================================================
6. PREMIER PATRON
==================================================

Génère immédiatement une première grille.

La grille doit utiliser exactement :

- la largeur choisie ;
- la hauteur choisie ;
- le nombre de couleurs choisi.


Chaque case contient un index correspondant
à une couleur de la palette.

La palette doit contenir exactement le nombre
de couleurs utilisé par la grille.


==================================================
7. QUALITÉ DU PREMIER JET
==================================================

Le premier jet est extrêmement important.

Il doit être visuellement cohérent.

Ne cherche PAS à conserver chaque détail
de la photographie.

Cherche à produire un motif que l'utilisateur
pourrait réellement avoir envie de crocheter.


Si plusieurs interprétations sont possibles,
privilégie celle qui rend le sujet immédiatement
reconnaissable.


==================================================
FORMAT
==================================================

Retourne uniquement les données correspondant
au schéma JSON demandé.

`
        });


      const rec =
        result.recommendations;


      /* ----------------------------------------------
         NORMALISATION DES DIMENSIONS
         ---------------------------------------------- */

      rec.dimension_options =
        normalizeDimensionOptions(
          rec
        );


      if(
        !rec.dimension_options.length
      ){

        rec.dimension_options = [

          {
            width:
              clamp(
                rec.width,
                20,
                120
              ),

            height:
              clamp(
                rec.height,
                20,
                120
              )

          }

        ];

      }


      rec.width =
        clamp(
          rec.width ||
          rec.dimension_options[0].width,
          20,
          120
        );


      rec.height =
        clamp(
          rec.height ||
          rec.dimension_options[0].height,
          20,
          120
        );


      /* ----------------------------------------------
         NORMALISATION COULEURS
         ---------------------------------------------- */

      rec.colors =
        clamp(
          rec.colors,
          4,
          16
        );


      rec.min_colors =
        clamp(
          rec.min_colors,
          2,
          rec.colors
        );


      rec.max_colors =
        clamp(
          rec.max_colors,
          rec.colors,
          16
        );


      /* ----------------------------------------------
         PALETTE
         ---------------------------------------------- */

      const palette =
        Array.isArray(
          result.palette
        )
          ? result.palette.slice(
              0,
              rec.colors
            )
          : [];


      const grid =
        result.grid;


      /* ----------------------------------------------
         VALIDATION PREMIER PATRON
         ---------------------------------------------- */

      if(
        palette.length !==
        rec.colors
      ){

        throw new Error(
          "La première palette produite par l'IA n'est pas cohérente."
        );

      }


      if(
        !validateGrid(
          grid,
          rec.width,
          rec.height,
          palette.length
        )
      ){

        throw new Error(
          "La première grille produite par l'IA n'est pas cohérente avec ses paramètres."
        );

      }


      return res
        .status(200)
        .json({

          analysis:
            result.analysis,

          recommendations:
            rec,

          palette,

          grid

        });

    }


    /* ==================================================
       DEUXIÈME GÉNÉRATION
       ================================================== */

    if(
      action === "generate"
    ){

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


      if(
        !analysis
      ){

        return res
          .status(400)
          .json({
            error:
              "Analyse manquante."
          });

      }


      const result =
        await callVision({

          image,

          name:
            "crochet_generation",

          schema:
            generationSchema,


          prompt:`

Crée une nouvelle version d'un patron
de tapestry crochet à partir de cette image.

Tu disposes également de l'analyse interne
réalisée précédemment.

ANALYSE INTERNE :

${JSON.stringify(
  analysis
)}


PARAMÈTRES DEMANDÉS :

Largeur :
${w}

Hauteur :
${h}

Nombre de couleurs :
${c}


==================================================
OBJECTIF
==================================================

Le patron doit rester reconnaissable.

Ne fais PAS une simple réduction
pixel par pixel de la photographie.

Interprète graphiquement le sujet.


==================================================
RÈGLES
==================================================

- exactement ${h} lignes ;
- exactement ${w} cellules par ligne ;
- exactement ${c} couleurs dans la palette ;
- chaque cellule contient uniquement un entier
  entre 0 et ${c - 1} ;
- palette en HEX #RRGGBB ;
- priorité à la silhouette ;
- priorité aux contours ;
- priorité aux contrastes ;
- conserve les éléments caractéristiques ;
- simplifie les détails secondaires ;
- simplifie le fond ;
- évite le bruit de pixels ;
- produis un motif réellement exploitable
  en tapestry crochet.


==================================================
IMPORTANT
==================================================

Le changement de dimensions ne doit pas simplement
déformer mécaniquement l'ancien patron.

Recompose le motif en fonction des nouvelles
dimensions afin de conserver au mieux
la lisibilité du sujet.


Retourne uniquement les données
correspondant au schéma JSON demandé.

`

        });


      if(
        !validateGrid(
          result.grid,
          h,
          w,
          result.palette.length
        )
      ){

        return res
          .status(422)
          .json({
            error:
              "L'IA a produit une grille incohérente. Essaie une autre combinaison de dimensions ou de couleurs."
          });

      }


      if(
        result.palette.length !== c
      ){

        return res
          .status(422)
          .json({
            error:
              "L'IA n'a pas produit le bon nombre de couleurs. Essaie à nouveau."
          });

      }


      return res
        .status(200)
        .json(
          result
        );

    }


    return res
      .status(400)
      .json({
        error:
          "Action inconnue."
      });


  }catch(error){

    console.error(
      "/api/analyze",
      error
    );


    return res
      .status(500)
      .json({

        error:
          error?.message ||
          "Erreur inattendue de l'IA."

      });

  }

}
