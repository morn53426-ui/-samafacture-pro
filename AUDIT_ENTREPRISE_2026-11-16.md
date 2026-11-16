# Audit technique — socle Entreprise, invitations et abonnement mensuel

Date : 16 novembre 2026  
Branche : `feat/enterprise-multi-company-foundation-20261116`  
Dernier commit de code testé : `0e0b304faecbe2d623ffdd813cf62e40cf8bdea6`  
Branche de référence synchronisée : `main` à `70750be430c83c4bf3ff369ad453c7b1fd1af511`

## Périmètre

Revue du socle multi-sociétés, des migrations SQL, de l'isolation tenant, des invitations/acceptations/révocations, du tableau de bord Entreprise, de la file email durable, des retours d'interface et des garde-fous de paiement. Cette revue technique ne constitue pas une validation juridique, fiscale ou de sécurité indépendante.

## Corrections apportées

### Groupe multi-sociétés et invitations concurrentes

- Les sociétés restent des comptes/tenants distincts ; aucune facture, écriture, dépense ou fiche client historique n'est déplacée.
- La création d'invitation utilise une transaction et verrouille la ligne du groupe avec `SELECT ... FOR UPDATE`. Deux créations concurrentes pour le même destinataire ne peuvent donc pas créer deux invitations actives ; la seconde requête reçoit HTTP 409.
- L'acceptation vérifie l'adresse email du compte, l'état du plan Entreprise et le fait que la société n'appartient pas déjà à un groupe. Le propriétaire doit accepter explicitement le rattachement.
- La révocation est transactionnelle et annule les messages encore en file. Un email déjà pris en charge par le transport SMTP ne peut pas être rappelé.

### Outbox email durable

La migration 007 ajoute `email_outbox`, et le schéma passe à la version 11. L'invitation et son email chiffré sont enregistrés dans la même transaction SQL.

- Le contenu contenant l'adresse et le lien d'invitation est chiffré en AES-256-GCM. Seul le hash SHA-256 du jeton d'invitation est conservé dans la table d'invitations.
- La clé de chiffrement utilise `DATA_ENCRYPTION_KEY` (clé de production requise) ; `JWT_SECRET` sert uniquement de solution de repli pour les environnements qui n'ont pas configuré la clé dédiée.
- Le worker réserve les tâches avec `FOR UPDATE SKIP LOCKED`, utilise un bail de cinq minutes et récupère les tâches dont le worker précédent a disparu.
- Les erreurs SMTP sont journalisées sous forme de codes bornés, sans destinataire, lien ou contenu de message.
- Le délai de connexion et de salutation SMTP est limité à 10 secondes, et le délai de socket à 30 secondes.
- Les délais de reprise progressent de 1 min, 5 min, 30 min, 2 h, 6 h, 12 h puis 24 h, avec un plafond de huit tentatives. Une tâche reprise après un crash au huitième essai est passée en échec sans neuvième appel SMTP.
- Les emails des invitations expirées, révoquées ou acceptées sont annulés lorsqu'ils sont encore en attente ou récupérés après expiration du bail.
- Le worker email est démarré dans les processus applicatifs et arrêté pendant l'arrêt propre du serveur.

**Garantie réelle : livraison au moins une fois, pas exactement une fois.** Si le serveur SMTP accepte le message puis que le processus s'arrête avant d'enregistrer l'état `sent`, la reprise peut renvoyer le même email. Ce comportement est préférable à la perte silencieuse du message, mais peut produire un doublon. SMTP ne fournit pas à lui seul une clé d'idempotence de bout en bout.

### Retour d'interface et accessibilité

La page Entreprise distingue les états en file, en traitement, en reprise, envoyé, échoué et annulé. L'avertissement affiché n'affirme plus à tort que SMTP est absent ; il reflète le résultat de l'API. Le résultat est annoncé à l'aide de `role="status"` et `aria-live="polite"`, et le lien est échappé avant insertion dans le DOM.

### Exactitude des agrégats financiers

Le tableau de bord du groupe exclut les factures au statut `annulee` des nombres, du total facturé et du montant encaissé. Le test d'intégration utilise une facture active de 1 000 FCFA dont 250 FCFA sont encaissés, et une facture annulée de 9 000 FCFA ; seuls la facture active et ses montants sont consolidés.

### Migrations

Le test d'upgrade simule une base existante en version 9, retire les tables des migrations 006/007, réexécute l'initialisation dans un autre processus et vérifie le passage à la version 11 ainsi que la recréation des tables de groupe et d'outbox.

## Vérifications GitHub Actions

Révision testée : `0e0b304faecbe2d623ffdd813cf62e40cf8bdea6`

- Tests Node.js/MySQL : **322 réussis, 0 échec**, 50 suites.
- `npm audit` : **0 vulnérabilité**.
- Smoke test du démarrage en cluster : **2 workers**, MySQL prêt et Redis opérationnel.
- Recette visuelle Chromium : **119 captures**, 7 largeurs, dataset extrême `worst`.
- Construction Docker, vérification de l'absence de secrets locaux, `npm ci`, détection Chromium et validation staging : réussies.
- Archive source ZIP : construite avec succès.

Exécutions :
- [Tests automatisés — run 708](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43925954252)
- [Package source ZIP — run 462](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43925954154)
- [Captures de la recette visuelle](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43925954252/artifacts/14255458288)

## Limites et risques restant à traiter

1. **Idempotence de livraison SMTP :** un doublon reste possible en cas de crash après acceptation du message par SMTP et avant l'acquittement SQL. L'outbox garantit une reprise, pas exactement une livraison.
2. **Récupération du lien d'invitation :** le lien est retourné lors de la création et peut être copié à ce moment-là, mais la page de liste ne permet pas encore de le récupérer après un rechargement. Prévoir un endpoint propriétaire authentifié, limité aux invitations actives, qui déchiffre le lien à la demande.
3. **Relance manuelle :** les emails définitivement échoués sont visibles en statut, mais le propriétaire ne dispose pas encore d'une action de relance ou de correction SMTP depuis l'interface.
4. **Rotation de clé :** la clé `DATA_ENCRYPTION_KEY` doit rester stable tant qu'il existe des messages chiffrés en attente. Une procédure de rotation et de re-chiffrement versionnée reste à définir.
5. **Concurrence acceptation/révocation :** une remise déjà en cours chez SMTP ne peut pas être annulée. Le worker vérifie l'état de l'invitation avant l'envoi, mais une modification peut survenir après cette vérification.
6. **Scalabilité Entreprise :** la liste des sociétés et les agrégats ne sont pas paginés et aucun quota produit définitif (sociétés, sièges, stockage, API/automations) n'est appliqué.
7. **Droits :** le propriétaire du groupe obtient des droits administrateur sur chaque filiale acceptée ; les rôles granulaires par société ne sont pas encore implémentés.
8. **Comptabilité multi-devise/OHADA :** l'agrégation reste séparée par devise ; aucune conversion de change, consolidation légale ou certification fiscale nationale n'est effectuée.
9. **Abonnements mensuels renouvelables :** ils ne sont pas activés. Le backend bloque la souscription par HTTP 503 tant qu'un mandat de débit récurrent, le prix mensuel, le consentement, les notifications, les retries, la grâce, la résiliation et les scénarios d'impayé ne sont pas validés. Les montants actuels du backend sont des paiements ponctuels ; les prix du plan d'entreprise restent des hypothèses commerciales.
10. **Recette navigateur/conformité :** la recette responsive vérifie Chromium ; Firefox, Safari et une certification WCAG complète ne sont pas couverts.
11. **Protection GitHub :** les protections de `main` n'ont pas pu être confirmées par l'intégration disponible ; la fusion ne doit pas être effectuée sur la base de ce seul audit.

## Décision

Aucune fusion dans `main`. La PR #60 reste un brouillon en attente d'une revue humaine indépendante et de la vérification des protections de branche. Aucun prélèvement mensuel automatique ni aucune disponibilité commerciale internationale générale ne doivent être annoncés avant validation des critères produit, fournisseur, réglementaires et opérationnels.
