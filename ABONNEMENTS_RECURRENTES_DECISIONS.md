# Facturation récurrente — décisions requises avant développement

**État fonctionnel du dépôt audité le 16 novembre 2026 :** les plans Starter, Pro et Entreprise sont activés après confirmation d'un paiement ponctuel. Le backend indique `mode: paiement_unique`, `renouvellement_automatique: false` et `expiration_automatique: false`. Aucun débit périodique ni mécanisme de renouvellement n'est actuellement revendiqué.

## Documentation fournisseur consultée

- [Wave Checkout API](https://docs.wave.com/checkout) : la documentation consultée décrit des sessions de checkout, leur consultation, leur expiration et leur remboursement. La page consultée ne décrit pas de ressource d'abonnement ou de mandat de prélèvement périodique.
- [Wave Business APIs](https://docs.wave.com/business) : les familles d'API visibles incluent balance/réconciliation, checkout, payout, agrégateurs et webhooks. La documentation consultée ne décrit pas de gestion d'abonnement.
- [PayDunya HTTP/JSON](https://developers.paydunya.com/doc/FR/http_json) : le parcours décrit une facture et un token pour initier/contrôler une transaction, avec états pending/cancelled/completed. La page consultée ne décrit pas de mécanisme de prélèvement récurrent.

**Limite de cette vérification :** l'absence de ces fonctionnalités dans les pages consultées ne prouve pas qu'elles n'existent dans aucun produit, contrat ou offre fournisseur. Obtenir une confirmation écrite des équipes commerciales/techniques, des conditions d'accès et des autorisations du compte marchand avant de retenir une intégration.

## Décisions produit nécessaires

- [ ] Fréquence : mensuelle, annuelle, ou les deux ; date de début et fuseau horaire de référence.
- [ ] Devise et pays : XOF uniquement ou devises locales supplémentaires ; prix par pays et règles d'arrondi.
- [ ] Durée : sans engagement, période minimale ou période d'essai.
- [ ] Renouvellement : date de renouvellement, information préalable, consentement explicite et reçu.
- [ ] Résiliation : immédiate ou en fin de période, traitement des accès et export des données.
- [ ] Échec de prélèvement : nombre de tentatives, délais, notification, période de grâce, suspension et réactivation.
- [ ] Changement de plan : prorata, crédit, upgrade/downgrade et date d'effet.
- [ ] Remboursements, litiges, chargebacks et traitement des paiements partiels.
- [ ] Fiscalité : TVA/taxes applicables par pays, facture du service SaaS et mentions obligatoires.
- [ ] Relation contractuelle : vendeur of record, frais, responsabilités du prestataire et protection du consommateur.

## Exigences techniques avant toute activation

- Contrat/mandat de paiement explicite, enregistré avec preuve et révocable ; ne jamais réutiliser un checkout ponctuel pour simuler un prélèvement sans autorisation fournisseur et client.
- Entité `subscription` avec états explicites (trial, active, past_due, grace, cancelled, expired) et historique immuable des périodes/factures.
- Webhooks signés, idempotence par identifiant fournisseur, vérification serveur du statut et réconciliation périodique avec l'API fournisseur.
- Verrouillage/concurrence pour empêcher deux facturations sur la même période et reprise sûre après panne.
- Journal d'audit, notification avant et après prélèvement, portail d'annulation et export des données.
- Tests de sandbox couvrant succès, échec, retard, webhook dupliqué/inversé, résiliation, prorata, remboursement et indisponibilité fournisseur.
- Revue sécurité/PCI de la portée réelle si carte bancaire ; SamaFacture Pro ne doit pas stocker les données carte.

## Critère de sortie

Ne pas afficher « abonnement mensuel », « renouvellement automatique » ou « paiement récurrent » tant qu'un fournisseur et un parcours périodique autorisé ne sont pas réellement intégrés, testés et activés sur un compte marchand de production. Les textes actuels doivent continuer d'indiquer paiement ponctuel.

**État : bloqué sur décisions produit, confirmation fournisseur et validation juridique/fiscale.**
