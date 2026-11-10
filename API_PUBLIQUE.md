# API publique SamaFacture Pro — v1

Cette API permet à un logiciel externe de lire certaines données du compte et de créer des factures. Elle est distincte de l'API privée utilisée par l'interface web.

## Adresse et authentification

L'URL de base est `https://votre-domaine.tld/api/v1`.

Chaque requête doit utiliser une clé API générée dans **Espace professionnel → API et intégrations** :

```http
X-SamaFacture-Key: sf_live_VOTRE_CLE
```

Le format `Authorization: Bearer sf_live_VOTRE_CLE` est également accepté. Une clé ne s'affiche qu'au moment de sa création. Conservez-la dans un gestionnaire de secrets et révoquez-la immédiatement en cas de fuite.

Les permissions sont attribuées à la clé lors de sa création :

- `clients:read`
- `products:read`
- `invoices:read`
- `invoices:write`

Chaque clé est liée à un compte propriétaire. Les requêtes ne peuvent pas consulter les données d'un autre compte.

## Endpoints disponibles

| Méthode | Chemin | Permission | Usage |
|---|---|---|---|
| GET | `/health` | Clé valide | Vérifie l'API |
| GET | `/clients` | `clients:read` | Liste les clients du compte |
| GET | `/products` | `products:read` | Liste le catalogue (prix de vente, stock, TVA) |
| GET | `/invoices?limit=50` | `invoices:read` | Liste jusqu'à 100 factures |
| POST | `/invoices` | `invoices:write` | Crée une facture |

Les opérations de création de clients/produits, l'enregistrement d'encaissements et le lancement de remboursements ne sont pas exposés par cette première version de l'API publique.

## Création d'une facture

Exemple :

```http
POST /api/v1/invoices
Content-Type: application/json
X-SamaFacture-Key: sf_live_VOTRE_CLE
Idempotency-Key: commande-boutique-2026-00042
```

```json
{
  "client_id": 12,
  "date_emission": "2026-11-10",
  "date_echeance": "2026-11-20",
  "commentaires": "Commande synchronisée depuis la boutique",
  "lignes": [
    {
      "designation": "Prestation de service",
      "quantite": 2,
      "prix_unitaire": 15000,
      "tva": 18
    }
  ]
}
```

La propriété `produit_id` est facultative. Lorsqu'elle est fournie, le produit doit appartenir au même compte que la clé API. Les lignes, la TVA, la remise éventuelle, la livraison et le stock suivent les règles de calcul de l'application.

`Idempotency-Key` est recommandé : si la même opération est répétée avec la même clé, l'API retourne la facture déjà créée au lieu d'en créer une seconde.

## Webhooks sortants

Les webhooks se configurent dans **Espace professionnel → API et intégrations**. Les événements actuellement émis sont :

- `client.created`
- `invoice.created`
- `payment.received`

Le test manuel émet également `test.ping`.

Chaque livraison envoie un JSON de la forme :

```json
{
  "id": 184,
  "event": "payment.received",
  "created_at": "2026-11-10T09:00:00.000Z",
  "data": {
    "invoice_id": 42,
    "montant": 15000,
    "methode": "virement"
  }
}
```

En-têtes fournis :

- `X-SamaFacture-Event` : nom de l'événement ;
- `X-SamaFacture-Delivery` : identifiant de livraison ;
- `X-SamaFacture-Signature` : signature HMAC-SHA256 sous la forme `sha256=...`.

La signature est calculée sur le corps JSON exact reçu, avec le secret affiché une seule fois à la création du webhook. Le système vérifie la file environ toutes les 30 secondes (réglable avec `WEBHOOK_DELIVERY_INTERVAL_MS`) et effectue jusqu'à cinq tentatives avec délais croissants en cas d'échec. Une réponse HTTP 2xx signifie que la livraison a réussi.

Les destinations doivent être accessibles publiquement en HTTPS sur le port standard. Les hôtes locaux et les adresses privées sont refusés afin de réduire le risque SSRF.

## Variables d'environnement importantes

- `APP_URL` doit correspondre à l'URL publique de l'application afin que les liens générés soient corrects.
- `DATA_ENCRYPTION_KEY` est recommandé pour chiffrer les secrets webhook indépendamment du secret JWT. Générez une valeur persistante avec `openssl rand -hex 32`. Si cette variable est absente, la clé JWT sert de repli ; ne changez donc pas cette clé sans avoir planifié la rotation des secrets webhook.
- Le serveur doit utiliser HTTPS derrière le reverse proxy. Les URLs webhook HTTPS sont obligatoires.

## Limites de cette version

Cette API v1 est volontairement réduite : elle ne propose pas encore de gestion complète des stocks, de modification/suppression des factures, de paiements, de remboursements ou de synchronisation bidirectionnelle. Les liens de paiement générés par l'interface sont des demandes de règlement partageables ; ils ne débitent pas automatiquement un client sans passerelle de paiement configurée.
