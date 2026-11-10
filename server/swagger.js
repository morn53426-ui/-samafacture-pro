const swaggerJsdoc = require('swagger-jsdoc');

// -----------------------------------------------------------------------------
// Documentation OpenAPI générée automatiquement à partir des commentaires @openapi
// placés directement au-dessus de chaque route dans server/routes/*.js — plutôt qu'un
// fichier YAML séparé à maintenir manuellement en plus du code, qui finit toujours par
// diverger de l'implémentation réelle. Voir /api/docs une fois le serveur démarré.
// -----------------------------------------------------------------------------

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'SamaFacture Pro API',
    version: '1.0.0',
    description: "API de facturation multi-tenant pour commerçants, artisans et PME d'Afrique de l'Ouest. " +
      "Toutes les routes (sauf mention contraire) exigent un jeton JWT obtenu via /auth/login ou /auth/register, " +
      "à passer dans l'en-tête `Authorization: Bearer <token>`. Chaque utilisateur ne voit et ne modifie que ses " +
      "propres données (clients, factures, produits...) — l'API est cloisonnée par compte."
  },
  servers: [
    { url: '/api', description: "Serveur courant (relatif — fonctionne en local et une fois en ligne)" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    schemas: {
      Erreur: {
        type: 'object',
        properties: { error: { type: 'string', example: 'Message décrivant le problème.' } }
      },
      Client: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 12 },
          nom: { type: 'string', example: 'Fatou Ndiaye' },
          email: { type: 'string', nullable: true, example: 'fatou@example.com' },
          telephone: { type: 'string', nullable: true, example: '+221 77 123 45 67' },
          whatsapp: { type: 'string', nullable: true },
          adresse: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
          photo: { type: 'string', nullable: true, description: 'Image encodée en base64 (data URL).' }
        }
      },
      Produit: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nom: { type: 'string', example: 'Sac en cuir artisanal' },
          description: { type: 'string', nullable: true },
          prix_unitaire: { type: 'number', example: 15000 },
          tva: { type: 'number', example: 18 },
          stock: { type: 'integer', nullable: true }
        }
      },
      LigneFacture: {
        type: 'object',
        required: ['designation', 'quantite', 'prix_unitaire'],
        properties: {
          produit_id: { type: 'integer', nullable: true },
          designation: { type: 'string', example: 'Sac en cuir artisanal' },
          quantite: { type: 'number', example: 2 },
          prix_unitaire: { type: 'number', example: 15000 },
          tva: { type: 'number', example: 18 }
        }
      },
      Facture: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          type: { type: 'string', enum: ['facture', 'devis'] },
          numero: { type: 'string', example: 'FAC-2026-0042' },
          client_id: { type: 'integer' },
          statut: { type: 'string', enum: ['en_attente', 'payee', 'en_retard', 'annulee'] },
          date_emission: { type: 'string', format: 'date' },
          date_echeance: { type: 'string', format: 'date', nullable: true },
          date_validite: { type: 'string', format: 'date', nullable: true, description: 'Date limite de validité du devis.' },
          objet: { type: 'string', nullable: true, maxLength: 190 },
          reference_externe: { type: 'string', nullable: true, maxLength: 100 },
          conditions_reglement: { type: 'string', nullable: true, maxLength: 5000 },
          sous_total: { type: 'number' },
          total_tva: { type: 'number' },
          remise: { type: 'number' },
          frais_livraison: { type: 'number' },
          total: { type: 'number' },
          montant_paye: { type: 'number' },
          commentaires: { type: 'string', nullable: true },
          mode_paiement: { type: 'string', nullable: true }
        }
      },
      Depense: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          categorie: { type: 'string', example: 'Fournitures' },
          montant: { type: 'number', example: 8500 },
          date_depense: { type: 'string', format: 'date' },
          description: { type: 'string', nullable: true }
        }
      },
      Utilisateur: {
        type: 'object',
        description: "Ne contient jamais password_hash (retiré systématiquement avant l'envoi au client).",
        properties: {
          id: { type: 'integer' },
          nom: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          plan: { type: 'string', enum: ['gratuit', 'starter', 'pro', 'entreprise'] },
          devise: { type: 'string', example: 'FCFA' },
          entreprise_nom: { type: 'string', nullable: true },
          entreprise_adresse: { type: 'string', nullable: true },
          entreprise_telephone: { type: 'string', nullable: true },
          entreprise_email: { type: 'string', nullable: true },
          entreprise_ninea: { type: 'string', nullable: true },
          entreprise_rccm: { type: 'string', nullable: true },
          entreprise_site_web: { type: 'string', nullable: true },
          entreprise_banque: { type: 'string', nullable: true },
          entreprise_rib: { type: 'string', nullable: true },
          entreprise_conditions_reglement: { type: 'string', nullable: true },
          entreprise_mentions_legales: { type: 'string', nullable: true },
          entreprise_logo: { type: 'string', nullable: true, description: 'Image encodée en base64 (data URL).' },
          signature_default: { type: 'string', nullable: true, description: 'Image encodée en base64 (data URL).' },
          facture_template: { type: 'string', enum: ['classique', 'moderne', 'minimaliste', 'elegant', 'corporate', 'creatif', 'prestige', 'heritage', 'diamant', 'epure', 'azur', 'circuit', 'platine', 'atelier', 'saveurs'] },
          facture_personnalisation: {
            type: 'object', nullable: true,
            description: "Personnalisation visuelle appliquée par-dessus le modèle (voir PUT /auth/entreprise). Renvoyée déjà parsée (objet), jamais comme chaîne JSON.",
            properties: {
              couleur_principale: { type: 'string', nullable: true },
              couleur_secondaire: { type: 'string', nullable: true },
              couleur_texte: { type: 'string', nullable: true },
              police: { type: 'string', enum: ['defaut', 'sans', 'serif', 'mono'] },
              taille_texte: { type: 'string', enum: ['petit', 'normal', 'grand'] },
              epaisseur_texte: { type: 'string', enum: ['normal', 'moyen', 'gras'] },
              logo_taille: { type: 'string', enum: ['petit', 'moyen', 'grand'] }
            }
          }
        }
      },
      FactureRecurrente: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          client_id: { type: 'integer' },
          libelle: { type: 'string', example: 'Abonnement mensuel maintenance' },
          frequence: { type: 'string', enum: ['hebdomadaire', 'mensuelle', 'annuelle'] },
          prochaine_date: { type: 'string', format: 'date' },
          actif: { type: 'boolean' },
          remise: { type: 'number' },
          frais_livraison: { type: 'number' },
          mode_paiement: { type: 'string', nullable: true },
          commentaires: { type: 'string', nullable: true },
          lignes: { type: 'array', items: { $ref: '#/components/schemas/LigneFacture' } }
        }
      },
      AssistantConversation: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          titre: { type: 'string', example: 'Résumé des ventes de juillet' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      AssistantMessage: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          role: { type: 'string', enum: ['user', 'assistant'] },
          contenu: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }]
};

const options = {
  definition,
  apis: ['./routes/*.js'] // chemin relatif à server/ (où app.js exécute ce module)
};

module.exports = swaggerJsdoc(options);
