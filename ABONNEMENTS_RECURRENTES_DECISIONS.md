# Facturation récurrente — décisions et critères avant activation

**État fonctionnel audité le 17 novembre 2026 sur `main` (`d607e671d507`) :** les formules Starter, Pro et Entreprise sont prévues au mois avec renouvellement automatique, mais la souscription reste indisponible. L'API répond `wave: false`, `paydunya: false`, `tarifs: {}` et `facturation.disponible: false` sur `GET /api/abonnement/moyens-disponibles`. `POST /api/abonnement/payer` répond HTTP `503` avec `PAIEMENT_RECURRENT_NON_CONFIGURE` et ne crée aucune tentative de paiement.

Le champ `renouvellement_automatique: true` présent dans l'objet de statut décrit l'objectif produit mensuel ; il ne signifie pas qu'un mandat existe ou qu'un débit est actif. La page Abonnement conserve les offres payantes en préparation.

## Parcours fournisseurs actuellement présents

- [Wave Checkout API](https://docs.wave.com/checkout) : la documentation publique décrit une session de checkout individuelle, sa consultation, son expiration et son remboursement. Les endpoints documentés dans cette page ne décrivent pas de ressource d'abonnement ou de mandat réutilisable pour des prélèvements mensuels.
- [Wave Business APIs](https://docs.wave.com/business) : la documentation consultée présente les fonctions de checkout, de solde/réconciliation, payout, agrégation et webhooks ; elle ne décrit pas de gestion d'abonnement récurrent sur les pages examinées.
- [PayDunya HTTP/JSON](https://developers.paydunya.com/doc/FR/http_json) : le parcours documenté crée une facture de paiement et un token pour initier puis confirmer une transaction, avec des états tels que `PENDING`, `CANCELLED` et `COMPLETED`. La page consultée ne décrit pas de mécanisme de prélèvement mensuel récurrent.

Les intégrations actuelles du dépôt correspondent à ces parcours ponctuels : `creerSessionWave` dans `server/config/payments.js` et `creerFacturePaydunya` dans le même fichier. Elles ne doivent pas être réutilisées comme un mandat de prélèvement mensuel sans accord explicite du fournisseur et du client.

**Limite de la vérification :** l'absence d'un parcours récurrent dans les pages publiques examinées ne prouve pas qu'aucune offre contractuelle, API privée ou option spécifique de compte marchand n'existe. Obtenir une confirmation écrite de chaque fournisseur concernant l'éligibilité du compte marchand, le pays, le moyen de paiement, les conditions de tokenisation/mandat et les webhooks avant de retenir une intégration.

## Décisions produit confirmées

- [x] **Périodicité : mensuelle uniquement.** Pas de formule annuelle dans le périmètre actuellement demandé.
- [x] **Renouvellement : automatique chaque mois**, jusqu'à résiliation explicite par le client.

Ces deux choix définissent la cible produit. Ils n'activent aucun prélèvement. En local, aucun débit réel ne doit être exécuté ; aucune formule payante ne doit être présentée comme souscrite tant que le parcours fournisseur et les contrôles ci-dessous ne sont pas validés.

## État technique vérifié dans le dépôt

- `server/routes/abonnement.js` renvoie actuellement `wave: false`, `paydunya: false`, `tarifs: {}` et `disponible: false` ; la route `POST /payer` bloque la souscription payante avec HTTP 503.
- `server/database/schema.sql` contient `abonnement_paiements`, une table de tentatives de paiement avec fournisseur, référence, montant, statut et dates. Elle ne contient pas de mandat récurrent, de période d'abonnement, de prochaine date de renouvellement ni de preuve de consentement au prélèvement.
- `server/config/scheduler.js` expire les tentatives de paiement laissées en attente et traite les factures récurrentes émises aux clients. Il ne renouvelle pas les plans SaaS Starter, Pro ou Entreprise.
- Les callbacks historiques Wave/PayDunya savent confirmer une tentative existante après vérification de la signature/statut et du montant ; ils ne créent pas à eux seuls un abonnement ni un mandat réutilisable.

En conséquence, il n'existe actuellement ni prélèvement récurrent, ni cycle de facturation d'abonnement, ni expiration automatique d'un plan payant. Le renouvellement automatique est un objectif à implémenter, pas un comportement actif.

## Décisions encore nécessaires avant mise en service

- [ ] Jour et heure du renouvellement, fuseau horaire de référence, date de début et traitement des mois sans jour équivalent (ex. abonnement démarré le 31).
- [ ] Devise et pays : XOF uniquement ou devises locales supplémentaires ; prix mensuels par formule et règles d'arrondi.
- [ ] Durée : sans engagement, période minimale ou période d'essai.
- [ ] Résiliation : immédiate ou en fin de période, date d'effet, traitement des accès et export des données.
- [ ] Échec de prélèvement : nombre de tentatives, délais, notifications, période de grâce, suspension et réactivation.
- [ ] Changement de plan : prorata, crédit, upgrade/downgrade et date d'effet.
- [ ] Remboursements, litiges, chargebacks et traitement des paiements partiels.
- [ ] Fiscalité : TVA/taxes applicables par pays, facture du service SaaS et mentions obligatoires.
- [ ] Relation contractuelle : vendeur of record, frais, responsabilités du prestataire et protection du consommateur.
- [ ] Confirmation écrite du fournisseur et preuve que le compte marchand peut initier des débits mensuels récurrents pour les moyens ciblés.

## Exigences techniques avant toute activation

- Contrat/mandat de paiement explicite, recueilli avant le premier débit, horodaté, stocké avec preuve, affiché au client et révocable. Le choix d'un renouvellement automatique doit être séparé du paiement initial, jamais coché par défaut sans consentement.
- Entité `subscription` avec états explicites (`trial`, `active`, `past_due`, `grace`, `cancelled`, `expired`) et historique immuable des périodes, factures, tentatives et événements de renouvellement.
- Jeton/mandat fournisseur stocké de façon sécurisée ; ne jamais stocker les données de carte bancaire dans SamaFacture Pro.
- Webhooks signés, idempotence par identifiant fournisseur, vérification serveur du statut et du montant, et réconciliation périodique avec l'API fournisseur.
- Verrouillage/concurrence pour empêcher deux facturations sur la même période et reprise sûre après panne.
- Journal d'audit, notifications préalables et après prélèvement, portail d'annulation et export des données.
- Tests de sandbox couvrant succès, échec, retard, webhook dupliqué/inversé, consentement manquant/révoqué, résiliation, prorata, remboursement et indisponibilité fournisseur.
- Revue sécurité et conformité de la portée réelle si carte bancaire ; aucune donnée carte ne doit être stockée par SamaFacture Pro.

## Critère de sortie

Ne pas présenter la souscription mensuelle comme disponible ni laisser entendre qu'un débit automatique est actif avant :
1. confirmation écrite du fournisseur pour le compte marchand, le pays et les moyens visés ;
2. intégration d'un véritable mandat récurrent autorisé, distinct d'un checkout ponctuel ;
3. collecte et vérification du consentement explicite et révocable ;
4. implémentation du cycle d'abonnement, de la facturation de période, des tentatives, de la résiliation et de la réconciliation ;
5. réussite de tous les tests sandbox et contrôles de sécurité, puis validation de production.

La page peut uniquement afficher le statut « en préparation » et l'API doit continuer de refuser les souscriptions (HTTP 503) tant que ces conditions ne sont pas réunies. Les paiements ponctuels historiques restent présentés comme tels, sans être assimilés à un abonnement.

**État au 17 novembre 2026 : bloqué sur confirmation fournisseur, décisions opérationnelles, validation juridique/fiscale et implémentation du cycle récurrent.**
