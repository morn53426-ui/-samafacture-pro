# Phases 5 à 7 — CRM, portail client, internationalisation et automatisations

Cette livraison est proposée sur une branche séparée. Elle n'est pas encore déployée en production.

## Phase 5 — Portail client et CRM

### Portail client
- L'entreprise génère un lien individuel de 30 jours pour un client.
- Le secret n'est jamais stocké en clair : seule son empreinte SHA-256 est enregistrée.
- Le jeton est placé dans le fragment URL (`#token=`) et envoyé à l'API via l'en-tête `X-SF-Portal-Token`. Il n'est donc pas transmis dans les journaux HTTP de requête.
- Le client ne peut consulter que ses propres factures, devis, montants réglés, soldes et lignes de documents.
- Le client peut accepter ou refuser chaque devis une seule fois.
- L'entreprise peut révoquer un lien immédiatement ou le renouveler.
- Les réponses du portail utilisent `Cache-Control: no-store` et `Referrer-Policy: no-referrer`.

### CRM
- Historique des notes, appels, emails, réunions, relances et tâches par client.
- Dates de rappel, statut à faire/terminé/annulé, tâches ouvertes/en retard.
- Vérification du propriétaire du client à chaque opération : une entreprise ne peut pas créer une activité sur le client d'une autre entreprise.

### Conditions opérationnelles
- Le partage par email exige un SMTP fonctionnel. Sans SMTP, le lien est affiché une seule fois pour copie manuelle ; il n'est pas annoncé comme envoyé et n'est pas écrit dans les logs.
- Les liens expirent au bout de 30 jours et sont révocables. Un lien transmis à un tiers reste un secret porteur d'accès jusqu'à sa révocation/expiration.
- Les notifications email de réponse à un devis ne sont pas encore envoyées automatiquement à l'entreprise ; la décision est consultable dans le portail et la table des décisions.

## Phase 6 — Internationalisation

### Paramètres configurables par entreprise
- Pays, langue de l'interface (français/anglais), devise par défaut, fuseau horaire, format de date et régime fiscal indicatif.
- Les réglages sont propres à chaque entreprise et validés par une liste de valeurs prises en charge.
- Les nouveaux documents enregistrent leur devise ; les anciens documents conservent leur devise d'origine.
- Les formats monétaires et dates partagés par le frontend tiennent compte des paramètres enregistrés.

### Limites à connaître
- Aucun taux de change ni conversion automatique n'est appliqué.
- Les rapports multi-devises ne doivent pas être interprétés comme des totaux convertis dans une devise commune. Avant une exploitation internationale multi-devises, il faut ajouter des taux datés, une devise fonctionnelle, une devise de présentation et des rapports séparés/convertis.
- Les régimes fiscaux sont des paramètres descriptifs, pas un moteur fiscal. Les règles et déclarations par pays doivent être développées et validées avec un professionnel local.
- Les pays, langues et devises pris en charge sont une liste initiale, non une couverture de tous les pays.

## Phase 7 — Automatisations et analyses IA

### Automatisations planifiées
- Relance périodique des clients ayant des factures impayées.
- Rappel des devis à l'approche de leur date de validité, hors devis déjà décidés dans le portail.
- Alerte interne sur les produits ayant atteint leur seuil de stock minimum.
- Déduplication des exécutions pour éviter de répéter un email sur la même période/entité.
- Les règles peuvent être créées, activées, désactivées et supprimées depuis l'écran Automatisations.

### Assistant IA
- Analyse des créances arrivant à échéance, des factures en retard, des produits sous seuil et des clients inactifs.
- Les outils IA sont en lecture seule et utilisent les données de l'entreprise sélectionnée.
- Accès limité aux rôles autorisés à consulter les rapports, factures et clients.
- L'assistant n'effectue pas de paiement, remboursement, commande, ni envoi d'email sans action humaine.
- Le modèle IA est optionnel et nécessite une clé API Anthropic configurée sur le serveur ; chaque appel peut entraîner un coût fournisseur.

### Limites opérationnelles
- Les automatisations email requièrent `SMTP_HOST`, `SMTP_USER` et `SMTP_PASSWORD`.
- Si le SMTP est absent, l'automatisation est marquée `smtp_non_configure` et réessaie ultérieurement. Aucun email n'est prétendu envoyé.
- Les campagnes WhatsApp automatiques restent désactivées : un compte WhatsApp Business et son intégration/API sont nécessaires.
- Les règles ne font pas de marketing autonome ni de prise de décision commerciale sans validation humaine.

## Migration et recette

- Version du schéma : 7.
- Migration `005_portail_crm_international_ia.sql`.
- Colonnes ajoutées : paramètres internationaux, devise des documents, seuil minimum de stock.
- Tests d'intégration ajoutés pour le portail, les décisions sur devis, l'isolation CRM, la configuration internationale, les devises par document, les seuils de stock et les automations.
- À valider avant production : migration sur une copie de base, test SMTP réel, configuration de la clé Anthropic, tests de charge, revue sécurité du portail et recette sur iOS/Android.
