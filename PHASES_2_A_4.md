# Phases 2 à 4 — Paiements, comptabilité et achats/stocks

Cette livraison ajoute des fondations métier et des écrans dédiés. Elle est proposée sur une branche/PR séparée et ne signifie pas que les moyens de paiement sont activés en production ni que la comptabilité est certifiée.

## Phase 2 — Encaissements réels sur les factures

### Prestataires
- Wave Checkout : création d'une session par facture et confirmation du statut auprès de l'API Wave.
- PayDunya : création d'une facture hébergée, IPN contrôlé puis confirmation serveur-à-serveur.
- Le paiement est inscrit dans la table historique `paiements` et actualise `montant_paye` et le statut de la facture.
- La référence interne est opaque et aléatoire. Une répétition du webhook n'inscrit pas un deuxième paiement.
- Les secrets du compte marchand sont chiffrés dans `pro_payment_gateways` à l'aide de `DATA_ENCRYPTION_KEY`, avec une configuration propre à chaque entreprise. Les clés globales d'abonnement ne sont pas réutilisées.

### Configuration
1. Déployer avec une URL publique HTTPS et `APP_URL` correctement défini.
2. Générer une clé durable avec `openssl rand -hex 32` et la définir comme `DATA_ENCRYPTION_KEY`. La conserver hors Git et la sauvegarder : perdre cette clé empêche de déchiffrer les identifiants marchands.
3. Dans **Paiements en ligne**, renseigner les identifiants Wave Business ou PayDunya de l'entreprise.
4. Commencer en mode test PayDunya. Déclarer l'URL de webhook Wave `https://VOTRE-DOMAINE/api/payment-webhooks/wave` dans le tableau de bord Wave et sélectionner l'événement `checkout.session.completed`. PayDunya reçoit une URL de callback propre à chaque session.
5. Vérifier les retours sur `/paiement-retour.html`. Seul le webhook vérifié et la consultation serveur-à-serveur du prestataire confirment le paiement.

### Limites actuelles
- Les identifiants marchands ne sont pas encore préremplis : chaque entreprise doit configurer et tester ses propres clés.
- Les remboursements réels par API Wave/PayDunya ne sont pas inclus. Les demandes de remboursement de l'espace professionnel restent un suivi interne ; le remboursement doit être exécuté dans le portail du prestataire ou de la banque et sa référence saisie dans le système.
- Le paiement d'une facture porte sur son solde restant total. Le lien ne propose pas encore de paiement partiel, échéancier, frais ou choix de montant.
- Les tests utilisent une API Wave simulée et ne remplacent pas un paiement sandbox avec les identifiants marchands de l'entreprise.

## Phase 3 — Comptabilité en partie double (base SYSCOHADA)

### Fonctions
- Plan de comptes de démarrage et journaux VE, AC, BQ, CA et OD créés pour chaque entreprise.
- Saisie d'écritures avec au moins deux lignes ; une ligne ne peut être qu'au débit ou au crédit.
- Refus des écritures déséquilibrées et vérification que comptes et journaux appartiennent à l'entreprise active.
- Balance générale, grand livre et historique des écritures validées.
- Comptabilisation guidée d'une facture client, d'un encaissement enregistré et d'une dépense.
- Une source (facture/paiement/dépense) ne peut être comptabilisée deux fois par les actions guidées.

### Réserve de conformité
Le plan fourni est une base simplifiée inspirée du SYSCOHADA, pas un dossier de conformité comptable ou fiscale. Avant une utilisation statutaire, un expert-comptable habilité doit valider et compléter le plan, les journaux, les comptes de TVA, les règles par pays, les écritures d'achats/avoirs/immobilisations, les clôtures, les états financiers et les obligations déclaratives. Il faut également ajouter les contrepassations et la traçabilité des périodes clôturées avant de considérer le module comme un logiciel comptable réglementaire complet.

## Phase 4 — Fournisseurs, achats et stock multi-entrepôts

### Fonctions
- Fiches fournisseurs.
- Commandes d'achat multi-lignes avec quantités, prix, TVA, HT et TTC.
- Réception totale ou partielle dans un entrepôt, avec quantités commandées/reçues et reliquat.
- Entrepôts distincts, transferts, ajustements d'inventaire et historique des mouvements.
- Valorisation indicative au prix d'achat du catalogue.
- Le stock global du catalogue est synchronisé avec les quantités d'entrepôts. Les factures de vente et annulations écrivent aussi des mouvements dans le dépôt principal.

### Limites actuelles
- Les commandes fournisseurs ne créent pas automatiquement de facture fournisseur ni d'échéance de paiement.
- La réception nécessite que chaque ligne soit associée à un produit du catalogue.
- Le choix automatique de l'entrepôt de sortie pour une vente (FIFO/FEFO, lots, numéros de série) n'est pas encore disponible : les ventes sortent du dépôt principal.
- Les transferts et ajustements sont tracés mais l'inventaire avancé (lots, dates d'expiration, inventaire tournant, valorisation FIFO/CUMP certifiée) reste à développer.
- La valorisation utilise le dernier prix d'achat renseigné, ce n'est pas une valorisation comptable certifiée des stocks.

## Migration et tests

- Le numéro de schéma passe à 6. La migration `004_paiements_comptabilite_achats.sql` ajoute les tables ; elle est conçue pour être réexécutée sans dupliquer les structures.
- `produits.stock` passe de l'entier au décimal `DECIMAL(14,3)` pour les unités fractionnaires.
- Les tests ajoutés couvrent les clés marchandes chiffrées, la signature Wave, l'idempotence, la création d'achats, la réception partielle, la synchronisation des stocks et la partie double.
- Avant production : sauvegarde MySQL vérifiée, test de migration sur copie, vérification Wave/PayDunya sandbox, tests inter-entreprises, restauration de sauvegarde et recette navigateur sur téléphones réels.
