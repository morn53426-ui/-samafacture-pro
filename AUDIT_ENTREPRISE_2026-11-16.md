# Audit technique — socle Entreprise, invitations et abonnement mensuel

Date : 16 novembre 2026  
Branche : `feat/enterprise-multi-company-foundation-20261116`  
Dernier commit de code testé : `6adac3c457e090ad1edfad2b88a57251b82a6d08`  
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
- L'acceptation vérifie l'adresse email du compte, l'état du plan Entreprise et le fait que la société n'appartient pas déjà à un groupe. Le propriétaire doit accepter explicitement le rattachement.
- La révocation est transactionnelle et annule les messages encore en file. Un email déjà pris en charge par le transport SMTP ne peut pas être rappelé.

### Outbox email durable

La migration 007 ajoute `email_outbox`, et le schéma passe à la version 12. La séquence est conservée et ordonnée : v8 (base de `main`), v9 (`jour_ancre` avec reprise de la date d'échéance existante), v10 (index des échéances actives), v11 (groupes multi-sociétés via `006_company_groups.sql`), v12 (outbox email via `007_email_outbox.sql`). L'invitation et son email chiffré sont enregistrés dans la même transaction SQL.

- Le contenu contenant l'adresse et le lien d'invitation est chiffré en AES-256-GCM. Seul le hash SHA-256 du jeton d'invitation est conservé dans la table d'invitations.
- La récupération ultérieure du lien est exposée par `GET /company-group/invitations/:invitationId/link`, réservé au propriétaire du groupe. L'API vérifie l'appartenance, l'état et l'expiration de l'invitation, déchiffre le payload, compare l'adresse destinataire et vérifie le hash du jeton avec une comparaison à temps constant avant de restituer l'URL.
- Les réponses de création d'invitation et de récupération du lien portent `Cache-Control: no-store, private`, `Pragma: no-cache` et `Expires: 0` afin d'éviter la mise en cache d'une réponse contenant le jeton brut.
- La clé de chiffrement utilise `DATA_ENCRYPTION_KEY` (clé de production requise) ; `JWT_SECRET` sert uniquement de solution de repli pour les environnements qui n'ont pas configuré la clé dédiée.
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

Le test d'upgrade simule une base existante en version 8, retire les objets introduits après cette version (colonne et index v9/v10, tables de groupe et outbox), réexécute l'initialisation dans un autre processus et vérifie le passage à la version 12, la présence de `jour_ancre`, de l'index d'échéances et des tables de groupe/outbox, tout en préservant l'identité et l'email du propriétaire. Le test de quota vérifie aussi le chemin d'upgrade v7→v12.

## Vérifications GitHub Actions

Révision de code testée : `6adac3c457e090ad1edfad2b88a57251b82a6d08` (tête de code de la PR #60 validée par le run 732 ; les commits suivants ne modifient que ce rapport)

- Tests Node.js/MySQL : **325 réussis, 0 échec**, 50 suites.
- `npm audit` : **0 vulnérabilité**.
- Smoke test du démarrage en cluster : **2 workers**, MySQL prêt et Redis opérationnel.
- Recette visuelle Chromium : **119 captures**, 7 largeurs, dataset extrême `worst`.
- Construction Docker, vérification de l'absence de secrets locaux, `npm ci`, détection Chromium et validation staging : réussies.
- Archive source ZIP : construite avec succès.

Exécutions :
- [Tests automatisés Entreprise — run 732](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43937603519) : 325 tests réussis, 0 échec, 50 suites.
- [Package source ZIP Entreprise — run 486](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43937603522).
- [Validation PDF #56 — run 730](https://github.com/morn53426-ui/-samafacture-pro/actions/runs/43936717405) : 374 tests réussis, 0 échec, 47 suites ; Redis Streams smoke test et restauration réelle MySQL réussis ; 119 captures responsive sur 7 largeurs ; 0 vulnérabilité npm.
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
9. **Protection GitHub — bloquant avant fusion :** le 16 novembre 2026, la lecture de la branche `main` retourne `protected=false`, `protection.enabled=false` et `required_status_checks.enforcement_level=off` sans contrôle requis. La lecture des rulesets retourne une liste vide. Le détail des protections renvoie HTTP 403 à l'intégration ; leur activation doit être faite par un administrateur du dépôt. À cette date, `main` est donc effectivement non protégée ; aucune fusion ne doit être réalisée avant configuration puis vérification de la protection et des contrôles obligatoires.

## État des PR et décision

- PR #56 : ouverte, non fusionnée, tête actuelle `73120ef76062f01bfa1cf72022acbe00e26cd78a`. Le CI run 730 valide cette tête : 374 tests réussis, 0 échec, 47 suites, smoke Redis Streams, restauration réelle MySQL, recette Chromium 119 captures/7 largeurs et 0 vulnérabilité npm. Elle doit être fusionnée avant #60 pour respecter l'ordre des changements PDF, dates et migrations.
- PR #60 : ouverte, brouillon, base `main`. Le dernier commit de code testé `6adac3c457e090ad1edfad2b88a57251b82a6d08` est entièrement validé par le CI run 732 (325/325). Le rapport d'audit lui-même est documentaire et ne modifie pas la logique applicative. Les deux remarques automatisées de revue relatives à l'ordre des migrations et à la variable `outsiderRecipient` sont obsolètes, résolues et corrigées dans la révision de code testée.
- La fusion reste suspendue : `main` est confirmée non protégée (`protected=false`, `protection.enabled=false`, contrôles obligatoires désactivés et aucun ruleset visible). Un administrateur doit activer les protections et les contrôles requis, puis confirmer leur état. Une revue humaine indépendante est également requise. Aucune fusion automatique n'a été effectuée.

Aucun prélèvement mensuel automatique ni aucune disponibilité commerciale internationale générale ne doivent être annoncés avant validation des critères produit, fournisseur, réglementaires et opérationnels.
