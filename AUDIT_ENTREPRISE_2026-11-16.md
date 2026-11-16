# Audit technique — socle Entreprise et invitations multi-sociétés

Date : 16 novembre 2026  
Branche examinée : `feat/enterprise-multi-company-foundation-20261116`  
Branche de référence : `main` à `c298062b75a9f475c79db3febd55a8523e2743ae`

## Périmètre

Revue ciblée de la migration multi-sociétés, du middleware de sélection de tenant, du cycle d'invitation, de l'acceptation et de la révocation, du tableau de bord Entreprise, des retours d'interface et du garde-fou de paiement des plans SaaS.

## Corrections apportées

### Création concurrente des invitations

Le contrôle d'une invitation en attente et son insertion étaient séparés. Deux requêtes concurrentes pouvaient donc créer des invitations actives pour la même adresse.

La création utilise maintenant une transaction MySQL et verrouille la ligne du groupe avec `SELECT ... FOR UPDATE`. Les créations au sein d'un même groupe sont sérialisées entre les processus. Une deuxième demande pour une invitation encore active reçoit HTTP 409. L'acceptation conserve son verrouillage transactionnel et la contrainte unique du propriétaire de société reste le dernier garde-fou.

### Échec SMTP et retour d'interface

Après enregistrement de l'invitation, si SMTP échoue ou si l'envoi n'est pas confirmé, l'API retourne toujours le lien sécurisé au propriétaire avec `email_envoye: false` et un avertissement explicite. Le jeton brut n'est pas stocké en base : seul son hash SHA-256 est conservé.

L'interface Entreprise n'affirme plus à tort que SMTP n'est pas configuré pour chaque échec d'envoi. Elle affiche l'avertissement exact du serveur, échappe son contenu avant insertion HTML et annonce le résultat à l'aide de `role="status"` et `aria-live="polite"`. Quatre tests ciblés vérifient le retour accessible, le message de repli, l'échappement du lien et la protection `rel="noopener"`.

Limite restante : il n'existe pas encore de file d'outbox durable. Une interruption brutale du processus entre le commit SQL et l'envoi SMTP peut laisser une invitation enregistrée sans notification email. Une outbox chiffrée avec reprise et idempotence reste la prochaine évolution recommandée.

### Migration v9 vers v10

Le test de migration ne se limite plus à vérifier que les tables existent après une installation neuve. Il simule une base déjà marquée v9, retire les trois tables propres aux groupes multi-sociétés, relance l'initialisation dans un processus Node séparé puis vérifie :
- la progression du marqueur de schéma vers v10 ;
- la recréation des trois tables de groupes, rattachements et invitations ;
- la conservation des tables historiques (aucune suppression de données métier n'est incluse dans ce scénario).

### Exactitude des agrégats financiers du groupe

Le tableau de bord exclut maintenant les factures au statut `annulee` de ses nombres, montants facturés et montants encaissés. Le test d'intégration crée une facture active de 1 000 FCFA avec 250 FCFA encaissés et une facture annulée de 9 000 FCFA. Il vérifie que seuls une facture, 1 000 FCFA facturés et 250 FCFA encaissés apparaissent dans les agrégats de la filiale et du groupe.

### Tests de concurrence

Le test d'intégration envoie simultanément deux demandes d'invitation vers la même adresse et exige exactement une réponse HTTP 201 et une réponse HTTP 409. Il vérifie aussi qu'un envoi non confirmé est accompagné d'un avertissement.

## Vérifications GitHub Actions

Commit de code testé : `4eb41da4b3bdf774d4fc4fb198dedca3493e6fb5`

- Tests Node.js/MySQL : 316 réussis, 0 échec, 0 ignoré.
- Le scénario d'upgrade d'une base existante v9 vers v10 a réussi.
- Contrôle `npm audit` : aucune vulnérabilité détectée.
- Smoke test du cluster : deux workers démarrés ; MySQL prêt et Redis opérationnel.
- Recette visuelle Chromium : 119 captures sur 7 largeurs, dataset extrême (`worst`).
- Construction Docker et contrôle d'absence des fichiers secrets locaux : réussis.
- Installation des dépendances, détection Chromium, validation Compose et recette documentaire staging : réussies.
- Archive source ZIP : construite avec succès.

Exécutions :
- [Tests automatisés — run 675](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43914084796)
- [Package source ZIP — run 430](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43914084947)
- [Captures de la recette visuelle](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43914084796/artifacts/14247869474)

## Limites et risques restant à traiter

1. L'envoi des invitations nécessite une outbox durable et chiffrée pour couvrir les arrêts de processus après commit et avant email.
2. Les agrégations chargent toutes les sociétés liées sans pagination ni limite technique ; les quotas et la stratégie de pagination doivent être définis.
3. Le propriétaire du groupe obtient des droits administrateur après acceptation ; les rôles granulaires par filiale ne sont pas implémentés.
4. La consolidation reste descriptive par devise : aucune conversion de change ni consolidation comptable légale/OHADA n'est effectuée.
5. Les abonnements SaaS mensuels renouvelables automatiquement ne sont pas activés. Le checkout ponctuel Wave/PayDunya ne vaut pas mandat de débit récurrent. Le endpoint de paiement reste en garde-fou HTTP 503 jusqu'à validation d'un produit récurrent, des tarifs, du consentement et des tests fournisseur.
6. Les scripts du projet ne déclarent pas de commandes dédiées de lint/formatage. Firefox, Safari et une certification WCAG ne sont pas couverts par cette recette Chromium.
7. Les protections GitHub de `main` n'ont pas été confirmées par l'intégration disponible ; aucune fusion n'est autorisée par cet audit.

## Décision

Aucune fusion dans `main`. La branche reste à soumettre à une revue humaine indépendante et aux règles de protection GitHub. Les abonnements payants et les prélèvements récurrents ne sont pas activés par ces corrections.
