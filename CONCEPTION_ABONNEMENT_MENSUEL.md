# Conception technique — abonnements mensuels SamaFacture Pro

**Date : 17 novembre 2026**  
**Référence :** `main` au commit `12716c760a0874b393b235587028ba78970bb0b8`  
**Nature :** dossier d'architecture et de préparation. Ce document ne met en place aucun prélèvement, n'active aucun fournisseur et ne remplace pas la validation commerciale, juridique ou technique du prestataire.

## 1. Objectif et règles non négociables

SamaFacture Pro vise des formules Starter, Pro et Entreprise facturées au mois. Le renouvellement mensuel automatique ne peut avoir lieu que si le client a donné un consentement explicite, traçable et révocable et si un prestataire a effectivement autorisé un mandat réutilisable pour le compte marchand concerné.

Règles de conception :

1. **Le montant, la devise, le plan et la période sont déterminés côté serveur.** Le navigateur ne peut jamais fixer le montant à débiter.
2. **Le consentement au renouvellement est indépendant du paiement initial.** Il doit préciser le prix, la devise, la périodicité, la date de renouvellement ou la règle de calcul, ainsi que la manière de résilier. Le choix demeure révocable.
3. **Le renouvellement automatique est désactivé par défaut** dans la décision produit actuellement enregistrée. Il ne devient actif qu'après une action positive du client et la confirmation d'un mandat valide.
4. **Aucun accès payant n'est accordé sur la base d'un simple retour navigateur ou d'un webhook non vérifié.** Le statut, le montant, la devise et la référence sont confirmés côté serveur.
5. **Une période ne peut être débitée qu'une seule fois.** Chaque période possède une clé d'idempotence persistée et une contrainte unique en base.
6. **Les cartes et comptes de paiement ne sont jamais stockés par SamaFacture Pro.** Seuls les identifiants/token références fournis et autorisés par le prestataire sont conservés, dans un stockage protégé.
7. **Aucun changement ne doit contourner le blocage existant** tant que les conditions de sortie de ce document ne sont pas remplies.

Le choix enregistré dans le dépôt est donc : facturation mensuelle, renouvellement automatique possible jusqu'à résiliation, opt-in explicite et désactivé par défaut. La demande initiale de renouvellement automatique ne vaut pas autorisation de débiter un moyen de paiement.

## 2. État réel du dépôt au moment de l'audit

L'examen porte sur `server/routes/abonnement.js`, `server/routes/auth.js`, `server/database/schema.sql`, `server/config/scheduler.js` et `public/abonnement.html`.

- `GET /api/abonnement/moyens-disponibles` renvoie actuellement `wave: false`, `paydunya: false`, `tarifs: {}` et `facturation.disponible: false`.
- `POST /api/abonnement/payer` renvoie HTTP 503 avec `PAIEMENT_RECURRENT_NON_CONFIGURE`. Il ne crée pas une session de paiement de remplacement.
- `PUT /api/auth/plan` n'autorise que le retour au plan Gratuit. Une tentative de définir directement Starter, Pro ou Entreprise est refusée avec HTTP 403 (`PAIEMENT_REQUIS`).
- `server/database/schema.sql` ne définit qu'une table `abonnement_paiements` pour les tentatives historiques : utilisateur, plan, montant, devise, fournisseur, références, statut et dates. Elle ne représente ni abonnement courant, ni période payée, ni mandat réutilisable, ni preuve de consentement au renouvellement.
- `confirmerPaiement()` vérifie le montant et verrouille la ligne de paiement avant de mettre à jour `users.plan`. Elle n'enregistre pas de période SaaS, de date d'expiration ou de prochaine échéance. Elle ne doit donc pas devenir le moteur de renouvellement par simple réutilisation.
- `server/config/scheduler.js` expire les paiements d'abonnement restés en attente et traite les factures récurrentes émises par les entreprises à leurs propres clients. Il ne renouvelle pas les plans SaaS Starter, Pro ou Entreprise.

**Point de migration à traiter avant activation :** recenser les lignes historiques `abonnement_paiements` encore en attente/expirées et décider de leur traitement. Un callback historique ne doit pas activer un plan sans période d'abonnement valide et sans rattachement à une intention de souscription connue.

Les factures récurrentes des clients de SamaFacture et les abonnements SaaS payés par les utilisateurs sont deux domaines différents ; ils ne doivent pas partager le même état métier ou le même worker.

## 3. Capacités fournisseurs — distinction entre demande et prélèvement

### Wave

La documentation publique de Wave Checkout consultée décrit des sessions de checkout : création, consultation, liste/recherche, expiration et remboursement. Le parcours demande ensuite d'ouvrir le lien de lancement Wave. Les pages examinées ne décrivent pas une ressource de mandat réutilisable ou une API d'abonnement mensuel. En conséquence, le checkout actuel ne doit pas être présenté comme un prélèvement récurrent.

Référence : [Wave Checkout API](https://docs.wave.com/checkout), documentation consultée le 17 novembre 2026.

### PayDunya WebPay / HTTP-JSON

Le parcours HTTP/JSON décrit la création d'une facture de paiement et l'obtention d'un token pour suivre/confirmer une transaction. Les pages examinées ne documentent pas un mandat permettant de débiter automatiquement le même client chaque mois.

Référence : [PayDunya HTTP/JSON](https://developers.paydunya.com/doc/FR/http_json), documentation consultée le 17 novembre 2026.

### PayDunya Collect

PayDunya présente Collect comme un outil de collecte récurrente ou de masse. Son guide de fonctionnement permet de définir une fréquence, une date de début et une date limite, puis d'ajouter une liste de payeurs. Les destinataires reçoivent un SMS contenant un lien pour effectuer le paiement. Cette capacité peut automatiser l'envoi des demandes mensuelles ; elle ne démontre pas, à elle seule, un débit sans action du payeur ou une API de mandat réutilisable intégrable à SamaFacture Pro.

Références :
- [PayDunya — fonctionnement de Collect](https://paydunya.com/how-it-works)
- [PayDunya Collect](https://paydunya.com/collect)
- [PayDunya — FAQ et assistance intégration](https://paydunya.com/faq)

**Question fournisseur obligatoire :** PayDunya doit confirmer par écrit si une API Collect est accessible aux applications tierces du compte marchand concerné et si elle peut créer un mandat autorisant un débit mensuel sans validation manuelle du payeur à chaque échéance. Une API qui programme seulement des SMS avec des liens de paiement doit être classée « demande de paiement récurrente », pas « prélèvement automatique ».

Contact d'assistance intégration publié par PayDunya : +221 77 190 26 41. Ce contact ne constitue pas une confirmation de capacité ou d'éligibilité.

## 4. Modèle métier cible

### 4.1 Entités

| Entité proposée | Rôle | Données essentielles |
|---|---|---|
| `subscription_price_versions` | Catalogue de prix versionné et approuvé | plan, intervalle mensuel, montant, devise, fiscalité, dates d'effet, version |
| `subscriptions` | État courant de l'abonnement d'un compte | user_id, plan, statut, prix/version, période courante, prochaine échéance, renouvellement activé ou non |
| `subscription_consents` | Preuve immuable du consentement | plan/prix affichés, intervalle, texte/version/hash, choix explicite de renouvellement, horodatage UTC |
| `subscription_mandates` | Référence au mandat créé chez le fournisseur | fournisseur, référence externe, référence/token protégé, statut, dates d'autorisation/révocation |
| `subscription_periods` | Grand livre des périodes dues/payées | abonnement, début/fin de période, montant/devise figés, statut, clé d'idempotence |
| `subscription_payment_attempts` | Tentatives de paiement rattachées à une période | période, fournisseur, référence, montant/devise, tentative, résultat, code d'erreur |
| `subscription_webhook_events` | Inbox idempotente des événements prestataires | fournisseur, ID d'événement, hash du payload, résultat de vérification, reçu/traité le |
| `subscription_audit_events` | Historique métier non destructif | acteur, action, état précédent/suivant, date, référence d'opération |

Ces noms sont indicatifs. Les migrations doivent suivre la convention du dépôt et ne pas modifier destructivement `abonnement_paiements`, qui sert aux transactions historiques.

### 4.2 États d'abonnement proposés

- `incomplete` : intention créée, paiement initial ou autorisation du mandat non terminé.
- `active` : période payée et accès au plan autorisé.
- `past_due` : renouvellement arrivé à échéance, confirmation de paiement absente ou échec.
- `grace` : période de tolérance, uniquement si une durée et des règles ont été décidées.
- `cancel_at_period_end` : renouvellement arrêté, accès conservé jusqu'à la fin de la période déjà payée.
- `cancelled` : abonnement résilié et mandat révoqué/arrêté lorsque le fournisseur le permet.
- `expired` : période terminée sans renouvellement payé.

Aucun état `trial` n'est prévu tant qu'une période d'essai n'a pas été décidée. L'accès payant est fondé sur un abonnement actif et une période valide, pas uniquement sur la valeur `users.plan`.

### 4.3 Périodes et calcul de date

Chaque période est une paire `period_start` / `period_end` immuable. La prochaine période est calculée à partir de la date d'ancrage, avec un fuseau de référence explicite et une règle de fin de mois documentée (par exemple, abonnement commencé le 31). Les instants techniques sont stockés en UTC ; la date affichée au client est calculée dans le fuseau du compte.

**Décision encore requise avant codage :** fuseau de facturation, heure de renouvellement et règle pour les dates 29, 30 ou 31. Le worker ne doit pas dépendre d'une addition naïve de 30 jours.

## 5. Flux cible

### 5.1 Souscription initiale

1. Le serveur fournit les plans, versions de prix et conditions actuellement publiés. Aucun prix saisi par le navigateur n'est accepté.
2. L'utilisateur choisit une formule mensuelle. Le renouvellement est présenté séparément, avec une explication claire, et n'est pas activé par défaut selon la décision actuelle.
3. Si le client choisit le renouvellement automatique, l'interface recueille une action explicite sur le mandat et le renouvellement, affiche la périodicité, le montant, la devise et la règle de résiliation, puis enregistre une preuve versionnée.
4. Le serveur crée une souscription `incomplete`, un consentement immuable et une demande fournisseur corrélée par une référence interne idempotente.
5. Le fournisseur réalise le paiement initial et, le cas échéant, l'autorisation du mandat. Le prestataire doit retourner une référence de mandat valide, pas seulement un lien de paiement.
6. Le webhook est authentifié, stocké dans l'inbox, puis vérifié par interrogation serveur-à-serveur si l'API le permet. Le serveur compare le statut, la référence, le montant et la devise.
7. Dans une transaction SQL, la période initiale devient payée, le mandat passe à l'état autorisé si applicable, l'abonnement devient actif et le plan du compte est recalculé.

Si le fournisseur ne sait envoyer qu'un lien SMS à valider par le client, cette voie peut éventuellement servir à une collecte manuelle mensuelle, après validation du produit, mais elle ne peut jamais activer l'option de débit automatique.

### 5.2 Renouvellement mensuel

1. Le worker sélectionne uniquement les abonnements `active`, à renouvellement explicitement activé, avec consentement non révoqué et mandat autorisé.
2. Il crée la période à venir dans une transaction avec une contrainte unique sur abonnement + période.
3. Il crée une tentative avec une clé d'idempotence déterministe ; l'appel réseau au fournisseur est ensuite exécuté hors transaction SQL.
4. Le résultat fournisseur et le webhook sont traités de manière idempotente. Une confirmation valide du montant et de la devise marque la période payée.
5. L'accès est prolongé jusqu'à la nouvelle fin de période ; facture/reçu et notification sont générés.
6. En cas d'échec, l'abonnement passe à `past_due`. Le calendrier de nouvelle tentative, les notifications et la période de grâce doivent suivre une politique approuvée. En l'absence de politique, le système ne doit pas improviser de nouveaux débits.

### 5.3 Résiliation et retrait du consentement

- Le client peut désactiver le renouvellement depuis son compte ; l'action est horodatée et ajoutée au journal d'audit.
- Le système empêche immédiatement la création d'une nouvelle tentative de débit.
- La résiliation en fin de période est le comportement proposé pour préserver l'accès déjà payé, mais sa validation produit/juridique est encore requise.
- Si le prestataire fournit une API de révocation de mandat, elle est appelée et son résultat conservé. Sinon, le système marque le mandat comme à révoquer et ouvre une tâche opérationnelle.
- Une révocation du mandat ou du consentement bloque tout débit futur, même si l'abonnement était auparavant actif.

## 6. Règles de persistance et de sécurité

- Le montant et la devise sont figés dans la version de prix puis copiés dans la période. Un changement de prix ne réécrit jamais une période passée ; les règles de notification et de consentement en cas de changement doivent être validées.
- Une contrainte unique doit empêcher plusieurs périodes identiques pour un abonnement. Une contrainte unique sur `provider + provider_event_id` empêche le traitement multiple d'un même webhook.
- Le traitement webhook utilise l'identifiant d'événement fournisseur, une signature/hash vérifiée, le statut serveur confirmé, la référence interne, le montant exact et la devise. Les événements reçus en double ou dans le désordre ne doivent pas réactiver un plan ou créer un deuxième débit.
- Les mises à jour croisées de l'abonnement, de la période, de la tentative et de l'accès sont transactionnelles. Aucun appel réseau n'est gardé dans une transaction SQL ouverte.
- Le worker doit utiliser un verrou distribué comme les tâches actuelles du scheduler, plus une réservation/idempotence en base. Un verrou global seul ne remplace pas les contraintes uniques.
- Les identifiants et secrets prestataire restent côté serveur. Les éventuels tokens de mandat doivent être chiffrés ou conservés dans un coffre de secrets ; aucune donnée carte ou code PIN ne doit être stocké.
- Les payloads de webhooks conservés pour audit doivent être minimisés et ne jamais inclure de donnée d'authentification sensible.
- Toute décision de plan est serveur. `PUT /api/auth/plan` ne doit pas devenir un moyen de contourner l'état et la période d'abonnement.
- Les remboursements, litiges et chargebacks doivent produire des événements d'audit et une politique d'accès définie ; ils ne doivent pas être traités comme un simple webhook « paiement réussi ».

## 7. API cible — proposition, non implémentée

| Route proposée | But | Contrôles |
|---|---|---|
| `GET /api/abonnement/offres` | Lire les plans/prix actifs et leur version | prix provenant du serveur |
| `POST /api/abonnement/intentions` | Créer une intention de souscription et enregistrer le consentement | idempotence, utilisateur authentifié, offre active |
| `POST /api/abonnement/mandat` | Démarrer l'autorisation du mandat chez le fournisseur choisi | fournisseur approuvé et fonctionnalité réellement disponible |
| `GET /api/abonnement/actuel` | Lire l'abonnement, la période et le renouvellement | accès au compte concerné uniquement |
| `PUT /api/abonnement/renouvellement` | Activer/désactiver le renouvellement | consentement explicite, mandat valide à l'activation |
| `POST /api/abonnement/resiliation` | Planifier ou appliquer une résiliation | règle de résiliation validée |
| `POST /api/abonnement/webhook/:fournisseur` | Réceptionner les événements | signature/hash, inbox idempotente, confirmation fournisseur |

Les routes existantes `/moyens-disponibles`, `/payer`, `/statut/:reference` et les webhooks historiques ne doivent pas être retirés sans plan de compatibilité. Le refus HTTP 503 demeure en vigueur jusqu'à l'activation formelle d'un adaptateur approuvé.

## 8. Worker et politique de relance

Le scheduler SaaS doit être distinct de `verifierFacturesRecurrentes()`, qui émet les factures récurrentes des entreprises pour leurs clients.

Tâches cibles :
- détecter les périodes arrivant à échéance ;
- réserver chaque période de façon atomique ;
- demander un débit uniquement si le mandat et le consentement sont valides ;
- enregistrer la réponse du fournisseur ;
- gérer les échecs et notifications suivant une politique déterminée ;
- rapprocher périodiquement les états locaux et prestataires ;
- détecter les mandats expirés/révoqués et les webhooks manquants.

Les intervalles, heures de renouvellement, nombre de tentatives, délais entre tentatives et durée de grâce sont **à décider**. Aucun nombre de relances n'est codé en dur avant cette décision.

## 9. Tests obligatoires avant activation

### Tests unitaires
- calcul du prochain mois : 28/29/30/31, année bissextile, changement d'année et fuseau ;
- transitions d'état autorisées/interdites ;
- consentement absent, non explicite, révoqué ou version de conditions différente ;
- calcul du prix depuis le catalogue serveur ;
- clé d'idempotence stable et période unique ;
- webhook dupliqué, mal signé, ancien, désordonné ou associé au mauvais utilisateur ;
- montant/devises incorrects, montant absent ou arrondi incorrect ;
- résiliation et désactivation du renouvellement juste avant l'échéance.

### Tests d'intégration MySQL
- deux workers concurrents ne créent qu'une période et une tentative ;
- deux webhooks identiques ne créditent qu'une période ;
- une réponse fournisseur tardive ne crée pas de deuxième période ;
- le plan payant n'est activé qu'après confirmation serveur du paiement initial ;
- un mandat révoqué ou un consentement absent empêche la tentative de débit ;
- un échec ne prolonge pas la période ;
- le retrait d'un plan payant ne supprime pas l'historique de facture/paiement.

### Tests de contrat fournisseur et sandbox
Pour chaque prestataire approuvé : autorisation de mandat, premier paiement, prélèvement mensuel, solde insuffisant, mandat révoqué, webhook dupliqué, signature invalide, délai/réseau indisponible, remboursement, réconciliation et résiliation. Aucun test de production ni débit réel ne doit être utilisé pour valider ce parcours.

## 10. Décisions métier à finaliser

| Sujet | État | À confirmer |
|---|---|---|
| Fréquence | Décidé | mensuelle uniquement |
| Renouvellement | Décidé dans le dépôt | automatique possible, opt-in explicite, désactivé par défaut |
| Tarifs Starter / Pro / Entreprise | En attente | montant exact, devise, taxes, date d'effet |
| Devise initiale | À confirmer | XOF/FCFA et éventuelles devises futures |
| Date/heure de débit | En attente | fuseau, ancrage, règle pour le 29/30/31 |
| Engagement et essai | En attente | sans engagement, durée minimale, période d'essai éventuelle |
| Résiliation | En attente | immédiate ou fin de période, accès, révocation du mandat |
| Paiement échoué | En attente | retries, délais, notifications, période de grâce, suspension |
| Changement de plan | En attente | prorata, crédit, date d'effet et consentement |
| Taxes/facture SaaS | En attente | traitement fiscal et mentions obligatoires |
| Prestataire | Bloquant | API de mandat réutilisable et éligibilité écrite du compte marchand |

## 11. Plan de réalisation en phases

1. **Validation fournisseur et commerciale** : obtenir les réponses écrites, choisir les capacités disponibles et figer tarifs, devise et règles de cycle.
2. **Migration de données** : ajouter les nouvelles tables et index par migration idempotente ; inventorier les anciennes tentatives et conserver l'historique.
3. **Domaine abonnement** : implémenter les états, prix versionnés, consentements, mandats et périodes, sans appeler de fournisseur en production.
4. **Adaptateur sandbox** : implémenter le fournisseur retenu derrière une interface commune, avec faux fournisseur pour les tests locaux.
5. **Webhooks et worker** : inbox idempotente, verrouillage, facturation, relances, réconciliation, notifications et annulation.
6. **Portail client** : prix explicite, autorisation du renouvellement, prochaine échéance, historique, révocation et résiliation.
7. **Recette sécurité et production** : tests complets, revue sécurité, validation contractuelle/fiscale, configuration des secrets côté serveur et activation progressive avec supervision.

### Critères bloquants de mise en production

- confirmation écrite de l'existence et de l'éligibilité du mandat récurrent pour le compte marchand, le pays et le moyen choisi ;
- consentement explicite, horodaté, consultable et révocable ;
- période, prix, devise et règle de renouvellement déterministes ;
- protection contre doubles débits, replay de webhooks et courses concurrentes ;
- tests sandbox fournisseur réussis et rapprochement fiable ;
- procédures documentées de résiliation, remboursement, échec, support et incident ;
- approbation indépendante de la revue de code et validation de production.

Tant que ces critères ne sont pas remplis, `wave: false`, `paydunya: false`, `facturation.disponible: false` et HTTP 503 doivent être conservés.

## 12. Références

- Code vérifié : `server/routes/abonnement.js`, `server/routes/auth.js`, `server/database/schema.sql`, `server/config/scheduler.js`, `public/abonnement.html`.
- Décisions existantes : `ABONNEMENTS_RECURRENTES_DECISIONS.md`.
- [Wave Checkout API](https://docs.wave.com/checkout).
- [PayDunya HTTP/JSON](https://developers.paydunya.com/doc/FR/http_json).
- [PayDunya — fonctionnement de Collect](https://paydunya.com/how-it-works).
- [PayDunya Collect](https://paydunya.com/collect).
- [PayDunya FAQ](https://paydunya.com/faq).

**Statut final de ce dossier : architecture préparatoire seulement. Aucun schéma de production, mandat, débit ou renouvellement n'est activé par ce document.**
