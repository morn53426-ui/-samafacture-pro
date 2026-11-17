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
- L'acceptation vérifie le jeton d'invitation, l'égalité entre l'adresse invitée et celle du compte, le plan Entreprise et l'absence de rattachement antérieur.
- **Correction de sécurité sur la branche dédiée :** l'acceptation directe est remplacée par une preuve email indépendante. Un second jeton aléatoire de 256 bits est haché (SHA-256) en base, lié à l'identifiant du compte et à l'invitation, puis envoyé via l'outbox chiffrée. Le lien expire après 20 minutes, est consommable une seule fois et ne rattache aucune société avant validation. Les deux jetons du lien final sont placés dans le fragment URL (`#`), qui n'est pas transmis dans la requête GET ; la page les conserve temporairement dans `sessionStorage` pendant la redirection de connexion et ne les transmet qu'au corps de la requête POST. La redirection de connexion ne transporte donc aucun jeton dans sa query string. Les anciens liens utilisant encore la query string sont lus puis nettoyés pour préserver leur compatibilité pendant leur validité. Un délai de 60 secondes limite les renvois. Le worker vérifie que l'invitation et la preuve sont toujours actives. Le parcours classique d'inscription et les comptes existants ne sont pas modifiés.
- La révocation est transactionnelle et annule les messages encore en file. Un email déjà pris en charge par le transport SMTP ne peut pas être rappelé.

### Outbox email durable

La migration 007 ajoute `email_outbox` (v12). La branche de correction ajoute la migration 008 pour la preuve email (v13). La séquence ordonnée reste v8 (base de `main`), v9 (`jour_ancre`), v10 (index des échéances), v11 (groupes multi-sociétés), v12 (outbox email), v13 (preuve email à usage unique). L'invitation, le hash du jeton de preuve et le message chiffré sont enregistrés dans une transaction SQL.

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

Le test d'upgrade de la branche dédiée simule une base v8, retire les objets v9/v10, les tables de groupe, l'outbox et la preuve email, puis réexécute l'initialisation dans un autre processus. Il doit vérifier le passage v8→v13, les colonnes/index et les tables v11/v12/v13, tout en préservant le compte existant. Le test de quota historique couvre également v7→v12.

## Vérifications GitHub Actions

Révision de référence de la PR #60 : `df9c229ad0a2e19a4d4e0d43207aab9bdb4b6ee5`. La correction de preuve email est une branche empilée sur la PR #60. Les workflows `Tests automatisés` et `Package complete source ZIP` acceptent désormais aussi les PR dont la base est `feat/enterprise-multi-company-foundation-20261116`, afin que les tests et l'archive source soient construits sur la correction empilée.

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
8. **Recette navigateur/conformité :** la recette responsive vérifie Chromium ; Firefox, Safari et une certification WCAG complète ne sont pas couverts. Les anciens emails de preuve produits avant le passage aux fragments contenaient le jeton dans la query string ; ils restent compatibles pendant leur validité, mais les nouvelles preuves ne l'exposent plus dans la requête GET.
9. **Protection GitHub — active et vérifiée :** le ruleset `protect main` (ID `27410527`) est actif depuis le 16 novembre 2026 à 21:33 UTC et cible `refs/heads/main`. La branche retourne `protected=true`. Il exige une PR, au moins une approbation indépendante, la résolution des conversations, les contrôles `Tests Node.js et MySQL` et `Build complete source archive`, ainsi qu'une branche à jour. Suppression et force-push sont interdits ; aucun acteur de contournement n'est configuré.

## État des PR et décision

- PR #56 : ouverte, non fusionnée, tête documentaire actuelle `c33c9b71b954a0ed07bc4dc727cc7e91fa15e220`. Les contrôles obligatoires sur cette tête sont réussis : `Tests Node.js et MySQL` et `Build complete source archive`. Le smoke Redis Streams, le test de restauration réelle MySQL, la recette Chromium (119 captures sur 7 largeurs) et `npm audit` (0 vulnérabilité) ont également réussi. La comparaison avec `main` indique 142 commits en avance et aucun en retard. Aucune approbation indépendante n'est enregistrée ; la PR reste bloquée par la règle `protect main`.
- PR #60 : ouverte, brouillon ; le commit documentaire `3d153c2d102832f172bf82bd072ec11a89b8ec54` avait les deux contrôles obligatoires réussis lors de la dernière vérification. Les remarques sur les migrations v9/v10 et `outsiderRecipient` ont été vérifiées comme résolues.
- Branche dédiée `fix/enterprise-invitation-email-proof-20261116` : ajoute la migration v13, les deux étapes API, l'outbox de preuve et l'écran de confirmation. Elle doit obtenir sa propre CI verte avant validation définitive.
- **Vérification email — validation encore requise :** la branche dédiée ajoute un second jeton transmis directement à l'adresse invitée, distinct du lien récupérable par le propriétaire du groupe. Les tests prévus couvrent jeton erroné, mauvais compte, limitation de renvoi, consommation unique et expiration ; les résultats CI de cette branche doivent être vérifiés avant de considérer la correction validée. Une recette avec une vraie boîte mail de test reste nécessaire avant production.
- `main` est protégée par le ruleset actif `protect main` ; les contrôles CI et l'approbation indépendante doivent rester satisfaits. Aucune fusion ni approbation n'a été effectuée.

Aucun prélèvement mensuel automatique ni aucune disponibilité commerciale internationale générale ne doivent être annoncés avant validation des critères produit, fournisseur, réglementaires et opérationnels.

## Addendum — 17 novembre 2026 : invitations classiques d’équipe

La correction des invitations d’équipe classiques est portée par la branche fix/team-invitation-email-proof-20261117 et la PR brouillon [#72](https://github.com/morn53426-ui/-samafacture-pro/pull/72). Elle complète la preuve email du parcours multi-sociétés ; elle ne la remplace pas.

### Correctifs apportés

- La création de l’invitation, l’écriture dans l’outbox chiffrée et l’audit sont transactionnels. Le lien brut n’est plus renvoyé à l’administrateur et l’interface n’affiche plus un faux état « email envoyé » avant livraison.
- Le destinataire doit se connecter avec le compte correspondant à l’adresse invitée, puis ouvrir un second lien envoyé à cette même adresse. Le jeton de preuve est aléatoire, stocké sous forme SHA-256, valable 20 minutes et consommable une seule fois.
- Un délai anti-renvoi évite les envois répétés immédiats. Le worker vérifie que l’invitation et la preuve sont encore valides avant livraison ; les messages en attente sont annulés après acceptation.
- L’acceptation et la création du membre sont effectuées dans une transaction. Les requêtes concurrentes ne peuvent pas consommer deux fois le même jeton.
- Les nouveaux liens transportent leurs jetons dans le fragment URL, sont retirés de la barre d’adresse dès lecture et sont conservés en sessionStorage pendant le parcours de connexion. Les requêtes d’acceptation partent du compte personnel, sans l’en-tête d’un ancien espace sélectionné.
- La migration 009 ajoute pro_team_invitation_verifications et porte le schéma à la version 14.

### Validation CI du code

Sur le commit applicatif 024ab145c9564f472b8fca8871d2803f5a11c238, le workflow [Tests automatisés #44037122142](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/44037122142) est terminé avec succès :

- 414 tests exécutés : 413 réussis, 0 échec, 1 ignoré ;
- npm audit : 0 vulnérabilité signalée ;
- construction Docker et vérification du script de recette staging réussies ;
- smoke test cluster réussi : 2 workers, MySQL prêt et Redis opérationnel ;
- recette visuelle réussie : 133 captures, 7 largeurs, jeu de données extrême ;
- archive complète des sources générée avec succès.

Le parcours email est testé avec un expéditeur simulé dans la suite d’intégration ; une recette supplémentaire avec une vraie boîte mail de test et le fournisseur SMTP de production reste à réaliser. Le workflow ne contient pas d’étape indépendante de lint ou de typage statique : ces contrôles ne sont donc pas déclarés comme exécutés.

### Décision d’intégration

La PR #72 reste en brouillon et non fusionnée. main n’a reçu aucun de ces changements. La protection de main, les contrôles obligatoires et l’approbation indépendante restent requis avant toute intégration.
