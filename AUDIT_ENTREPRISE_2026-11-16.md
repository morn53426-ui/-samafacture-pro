# Audit technique — socle Entreprise, invitations et abonnement mensuel

Date : 16 novembre 2026  
Branche : `feat/enterprise-multi-company-foundation-20261116`  
Dernier commit de code testé : `84e2e0c74bbe242b7c7e39374af3e98a740d117e`  
Mise à jour de l'audit : 16 novembre 2026 (rapport actualisé après validation du socle Entreprise et de la file PDF)  
Branche de référence synchronisée : `main` à `70750be430c83c4bf3ff369ad453c7b1fd1af511`

## Périmètre

Revue du socle multi-sociétés, des migrations SQL, de l'isolation tenant, des invitations/acceptations/révocations, du tableau de bord Entreprise, de la file email durable, des retours d'interface et des garde-fous de paiement. Cette revue technique ne constitue pas une validation juridique, fiscale ou de sécurité indépendante.

## Corrections apportées

### File PDF durable (PR #56)

- Les nouvelles tâches sont publiées dans Redis Streams avec un hash de métadonnées propriétaire et un consumer group ; le worker conserve les entrées en PEL tant qu'elles ne sont pas terminales, puis écrit le statut avant `XACK`/`XDEL`.
- Les tâches pending sont récupérables par `XAUTOCLAIM`. L'ancienne file Redis List est migrée vers le stream via un script Lua qui n'effectue `LPOP` qu'après `XADD` réussi.
- **Correctif de rétention ajouté dans la PR #56 :** le TTL du hash qui contient l'autorisation de téléchargement est désormais au moins égal à la rétention du fichier PDF (`max(PDF_JOB_TTL_SECONDS, PDF_FILE_RETENTION_SECONDS)`). La valeur par défaut permet ainsi l'accès au propriétaire pendant les 25 heures de rétention du PDF ; auparavant le hash pouvait expirer après une heure et rendre le fichier existant inaccessible.
- Un test de non-régression vérifie l'égalité entre TTL des métadonnées d'accès et durée de rétention du fichier. La génération reste *au moins une fois* : une nouvelle tentative de rendu peut se produire si un worker tombe avant l'écriture de l'état terminal.

### Groupe multi-sociétés et invitations concurrentes

- Les sociétés restent des comptes/tenants distincts ; aucune facture, écriture, dépense ou fiche client historique n'est déplacée.
- La création d'invitation utilise une transaction et verrouille la ligne du groupe avec `SELECT ... FOR UPDATE`. Deux créations concurrentes pour le même destinataire ne peuvent donc pas créer deux invitations actives ; la seconde requête reçoit HTTP 409.
- L'acceptation vérifie le jeton, l'égalité entre l'adresse de l'invitation et celle portée par le compte, l'état du plan Entreprise et le fait que la société n'appartient pas déjà à un groupe. Le propriétaire doit accepter explicitement le rattachement.
- **Blocage sécurité restant :** l'inscription par email/mot de passe crée actuellement le compte et délivre immédiatement un JWT sans vérifier la possession de la boîte email ; le schéma `users` ne contient pas de preuve `email_verified_at`. L'acceptation multi-sociétés compare donc deux chaînes email, mais ne prouve pas à elle seule que le propriétaire connecté contrôle cette adresse. Le lien d'invitation peut en outre être récupéré par le propriétaire du groupe et partagé manuellement. Avant toute ouverture en production, prévoir une vérification email liée à l'identifiant du compte et à l'adresse exacte, avec jeton à usage unique, expiration, consommation atomique et invalidation lors d'un changement d'adresse. Ne pas déclarer ce parcours prêt pour la production avant ces garanties et les tests associés.
- La révocation est transactionnelle et annule les messages encore en file. Un email déjà pris en charge par le transport SMTP ne peut pas être rappelé.

### Outbox email durable

La migration 007 ajoute `email_outbox`, et le schéma passe à la version 12. La séquence est conservée et ordonnée : v8 (base de `main`), v9 (`jour_ancre` avec reprise de la date d'échéance existante), v10 (index des échéances actives), v11 (groupes multi-sociétés via `006_company_groups.sql`), v12 (outbox email via `007_email_outbox.sql`). L'invitation et son email chiffré sont enregistrés dans la même transaction SQL.

- Le contenu contenant l'adresse et le lien d'invitation est chiffré en AES-256-GCM. Seul le hash SHA-256 du jeton d'invitation est conservé dans la table d'invitations.
- La récupération ultérieure du lien est exposée par `GET /company-group/invitations/:invitationId/link`, réservé au propriétaire du groupe. L'API vérifie l'appartenance, l'état et l'expiration de l'invitation, déchiffre le payload, compare l'adresse destinataire et vérifie le hash du jeton avec une comparaison à temps constant avant de restituer l'URL.
- Les réponses de création d'invitation et de récupération du lien portent `Cache-Control: no-store, private`, `Pragma: no-cache` et `Expires: 0` afin d'éviter la mise en cache d'une réponse contenant le jeton brut.
- Le code de chiffrement utilise `DATA_ENCRYPTION_KEY` et prévoit un repli vers `JWT_SECRET`. En production, `validateProductionConfig()` bloque le démarrage si `DATA_ENCRYPTION_KEY` n'est pas une clé hexadécimale de 32 octets ; le repli ne doit donc servir qu'aux environnements non-production. La clé dédiée doit rester stable tant que des messages chiffrés sont en attente ; la rotation avec re-chiffrement versionné reste à documenter.
- Le worker réserve les tâches avec `FOR UPDATE SKIP LOCKED`, utilise un bail de cinq minutes et récupère les tâches dont le worker précédent a disparu.
- Les erreurs SMTP sont journalisées sous forme de codes bornés, sans destinataire, lien ou contenu de message.
- Le délai de connexion et de salutation SMTP est limité à 10 secondes, et le délai de socket à 30 secondes.
- Les délais de reprise progressent de 1 min, 5 min, 30 min, 2 h, 6 h, 12 h puis 24 h, avec un plafond de huit tentatives. Une tâche reprise après un crash au huitième essai est passée en échec sans neuvième appel SMTP.
- Les emails des invitations expirées, révoquées ou acceptées sont annulés lorsqu'ils sont encore en attente ou récupérés après expiration du bail.
- Le worker email est démarré dans les processus applicatifs et arrêté pendant l'arrêt propre du serveur.
- La relance manuelle est exposée par `POST /company-group/invitations/:invitationId/retry-email`, protégée par verrouillage transactionnel ; seules les invitations actives et non expirées dont le job est en échec définitif peuvent être remises en file (HTTP 202). Les tentatives sont réinitialisées et le bail précédent est effacé.
- La liste des invitations ne présente que les invitations envoyées et non expirées ; les états en file, en traitement, en reprise, échoué et annulé sont affichés dans les réponses de l'interface.

**Garantie réelle : livraison au moins une fois, pas exactement une fois.** Si le serveur SMTP accepte le message puis que le processus s'arrête avant d'enregistrer l'état `sent`, la reprise peut renvoyer le même email. Ce comportement est préférable à la perte silencieuse du message, mais peut produire un doublon. SMTP ne fournit pas à lui seul une clé d'idempotence de bout en bout.

### Retour d'interface et accessibilité

La page Entreprise distingue les états en file, en traitement, en reprise, envoyé, échoué et annulé. Elle conserve le lien renvoyé à la création, permet de le récupérer après rechargement pour une invitation active, et propose une relance uniquement pour un job en échec définitif. La copie utilise l'API Clipboard avec solution de repli. L'avertissement reflète le résultat réel de l'API, le retour est annoncé avec `role="status"` et `aria-live="polite"`, et les valeurs injectées dans le DOM sont échappées.

### Exactitude des agrégats financiers

Le tableau de bord du groupe exclut les factures au statut `annulee` des nombres, du total facturé et du montant encaissé. Le test d'intégration utilise une facture active de 1 000 FCFA dont 250 FCFA sont encaissés, et une facture annulée de 9 000 FCFA ; seuls la facture active et ses montants sont consolidés.

### Migrations

Le test d'upgrade simule une base existante en version 8, retire les objets introduits après cette version (colonne et index v9/v10, tables de groupe et outbox), réexécute l'initialisation dans un autre processus et vérifie le passage à la version 12, la présence de `jour_ancre`, de l'index d'échéances et des tables de groupe/outbox, tout en préservant l'identité et l'email du propriétaire. Le test de quota vérifie aussi le chemin d'upgrade v7→v12. Les remarques antérieures indiquant que v9/v10 auraient été sautées ne se reproduisent plus dans la tête actuelle : `server/config/db.js` conserve ces étapes avant les migrations v11/v12, et le scénario v8→v12 les vérifie.

## Vérifications GitHub Actions

Révision de code testée : `84e2e0c74bbe242b7c7e39374af3e98a740d117e` (tête actuelle de la PR #60 validée par le run 736 ; les commits suivants sont documentaires)

- Tests Node.js/MySQL : **325 réussis, 0 échec**, 50 suites.
- `npm audit` : **0 vulnérabilité**.
- Smoke test du démarrage en cluster : **2 workers**, MySQL prêt et Redis opérationnel.
- Recette visuelle Chromium : **119 captures**, 7 largeurs, dataset extrême `worst`.
- Construction Docker, vérification de l'absence de secrets locaux, `npm ci`, détection Chromium et validation staging : réussies.
- Archive source ZIP : construite avec succès.

Exécutions :
- [Tests automatisés Entreprise — run 736](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43941503899) : 325 tests réussis, 0 échec, 50 suites.
- [Package source ZIP Entreprise — run 490](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43941503977).
- [Validation PDF #56 — run 735](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43941457794) : 374 tests réussis, 0 échec, 47 suites ; Redis Streams smoke test et restauration réelle MySQL réussis ; 119 captures responsive sur 7 largeurs ; 0 vulnérabilité npm.
- La tête actuelle de #56 confirme aussi la décision documentaire de renouvellement mensuel automatique ; le CI run 730 sur cette tête est entièrement réussi.

## Limites et risques restant à traiter

1. **Idempotence de livraison SMTP :** un doublon reste possible en cas de crash après acceptation du message par SMTP et avant l'acquittement SQL. L'outbox garantit une reprise, pas exactement une livraison.
2. **Rotation de clé :** la clé `DATA_ENCRYPTION_KEY` doit rester stable tant qu'il existe des messages chiffrés en attente. Une procédure de rotation et de re-chiffrement versionnée reste à définir.
3. **Concurrence acceptation/révocation :** une remise déjà en cours chez SMTP ne peut pas être annulée. Le worker vérifie l'état de l'invitation avant l'envoi, mais une modification peut survenir après cette vérification.
4. **Scalabilité Entreprise :** la liste des sociétés et les agrégats ne sont pas paginés et aucun quota produit définitif (sociétés, sièges, stockage, API/automations) n'est appliqué.
5. **Droits :** le propriétaire du groupe obtient des droits administrateur sur chaque filiale acceptée ; les rôles granulaires par société ne sont pas encore implémentés.
6. **Comptabilité multi-devise/OHADA :** l'agrégation reste séparée par devise ; aucune conversion de change, consolidation légale ou certification fiscale nationale n'est effectuée.
7. **Abonnements mensuels renouvelables :** la cible produit est confirmée : périodicité mensuelle et renouvellement automatique jusqu'à résiliation explicite. Elle n'est pas activée. Le backend bloque la souscription par HTTP 503 tant qu'un prestataire autorisant réellement le débit récurrent, un mandat/consentement vérifiable, les prix, les notifications, les retries, la grâce, la résiliation et les scénarios d'impayé ne sont pas validés. En développement local, aucun prélèvement réel ne doit être exécuté ; les paiements ponctuels ne doivent pas être présentés comme des abonnements.
8. **Recette navigateur/conformité :** la recette responsive vérifie Chromium ; Firefox, Safari et une certification WCAG complète ne sont pas couverts.
9. **Protection GitHub — active et vérifiée :** le ruleset `protect main` (ID `27410527`) est actif depuis le 16 novembre 2026 à 21:33 UTC et cible `refs/heads/main`. La branche retourne `protected=true`. Il exige une PR, au moins une approbation indépendante, la résolution des conversations, les contrôles `Tests Node.js et MySQL` et `Build complete source archive`, ainsi qu'une branche à jour. Suppression et force-push sont interdits ; aucun acteur de contournement n'est configuré.

## État des PR et décision

- PR #56 : ouverte, non fusionnée, tête documentaire actuelle `c33c9b71b954a0ed07bc4dc727cc7e91fa15e220`. Les contrôles obligatoires sur cette tête sont réussis : `Tests Node.js et MySQL` et `Build complete source archive`. Le smoke Redis Streams, le test de restauration réelle MySQL, la recette Chromium (119 captures sur 7 largeurs) et `npm audit` (0 vulnérabilité) ont également réussi. La comparaison avec `main` indique 142 commits en avance et aucun en retard. Aucune approbation indépendante n'est enregistrée ; la PR reste bloquée par la règle `protect main`.
- PR #60 : ouverte, brouillon, tête `df9c229ad0a2e19a4d4e0d43207aab9bdb4b6ee5`, 86 commits en avance et aucun en retard par rapport à `main`. Les deux contrôles CI sont réussis sur cette tête (325 tests, 50 suites ; archive source réussie ; npm audit à 0 vulnérabilité). Les remarques antérieures sur la séquence de migrations et l'utilisation prématurée de `outsiderRecipient` sont résolues dans la version actuelle : le test v8→v12 couvre v9/v10, et la variable est déclarée avant son utilisation. La PR demeure un brouillon et aucune approbation indépendante n'est enregistrée.
- **Blocage P1 avant mise en production :** l'adresse email du compte invité n'est pas vérifiée indépendamment avant l'acceptation d'une invitation multi-sociétés. La vérification actuelle compare l'adresse du compte au texte de l'invitation ; l'inscription classique autorise la création d'un compte avec une adresse non prouvée. Il faut définir et implémenter le parcours de vérification décrit plus haut, puis tester les expirations, rejeux, changements d'adresse et acceptations concurrentes.
- `main` est protégée par le ruleset actif `protect main` ; les contrôles CI et l'approbation indépendante doivent rester satisfaits. Aucune fusion ni approbation n'a été effectuée.

Aucun prélèvement mensuel automatique ni aucune disponibilité commerciale internationale générale ne doivent être annoncés avant validation des critères produit, fournisseur, réglementaires et opérationnels.
