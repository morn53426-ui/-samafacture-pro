# Guide opérationnel du pilote commercial — Sénégal

**Version :** 1.0 — 16 novembre 2026  
**Statut :** guide de travail à valider avant utilisation avec des entreprises réelles  
**Périmètre :** pilote exploratoire de 10 entreprises maximum  
**Document associé :** [Plan d’entreprise SUNUPILOT](PLAN_ENTREPRISE_SAMAFACTURE_PRO.md)

---

## 1. Objectif du pilote

Le pilote doit répondre à quatre questions avant d'investir dans une acquisition à grande échelle :

1. Les entreprises ciblées ont-elles un problème concret que SUNUPILOT résout ?
2. Peuvent-elles créer et retrouver leurs devis/factures sans aide permanente ?
3. Reviennent-elles utiliser le produit après leur première facture ?
4. Comprennent-elles l'offre et sont-elles prêtes à payer dans des conditions clairement annoncées ?

Le pilote est une étude exploratoire. Dix entreprises ne constituent pas un échantillon statistiquement représentatif du marché sénégalais. Les résultats servent à décider quoi améliorer et quoi tester ensuite, pas à annoncer une part de marché ou une prévision garantie.

## 2. Règles avant de contacter les pilotes

### 2.1 Ne pas confondre local, préproduction et production

Tant que l'application fonctionne uniquement sur l'ordinateur du développeur, elle peut servir aux démonstrations en présence ou aux essais internes, mais pas à un pilote distant fiable. Ne demandez pas à un prospect de saisir ses vraies données commerciales dans une installation locale inaccessible ou non sécurisée.

Avant d'ouvrir un accès distant, valider au minimum :

- [ ] Domaine et HTTPS fonctionnels ; URL de production cohérente dans la configuration.
- [ ] Secrets de production uniques, conservés hors du dépôt et non copiés depuis les exemples.
- [ ] MySQL et Redis non exposés directement à Internet.
- [ ] Isolation des données entre deux entreprises vérifiée avec deux comptes distincts.
- [ ] Parcours d'inscription, connexion, déconnexion et réinitialisation testés.
- [ ] Sauvegarde chiffrée et copie hors serveur configurées ; restauration réelle vérifiée dans une base séparée.
- [ ] Journaux et outils de support examinés pour éviter d'exposer mots de passe, jetons, liens privés ou données de facturation.
- [ ] Conditions, politique de confidentialité, identité de l'exploitant et moyen de contact renseignés puis validés.
- [ ] Parcours de facturation et de paiement testé en environnement de test du prestataire, y compris échec, doublon et remboursement.
- [ ] Procédure de signalement d'incident et de suspension d'accès connue.

Cette liste est un seuil opérationnel interne, pas une certification juridique ou de sécurité. Les obligations exactes doivent être confirmées selon l'exploitant, l'hébergement, les prestataires et les traitements réellement activés.

### 2.2 Protéger les données des participants

- Utiliser des données fictives pendant les démonstrations.
- Ne pas importer de carnet client ou de comptabilité réelle sans nécessité, autorisation et procédure validée.
- Informer les participants de ce qui est observé pendant le pilote et de la manière de les contacter.
- Ne jamais demander de mot de passe, code OTP, données de carte ou identifiants de portefeuille mobile.
- Ne pas placer de noms de clients, montants sensibles ou captures contenant des données réelles dans les issues GitHub ou les rapports publics.
- Obtenir un accord séparé et explicite avant toute citation, photo, logo ou témoignage public.
- Prévoir une procédure de sortie : arrêt du pilote, export ou suppression des données selon les engagements applicables.

## 3. Choisir les 10 entreprises

### 3.1 Tester deux segments, sans ouvrir trop de cas complexes

Pour une première cohorte, comparer deux groupes accessibles :

| Groupe exploratoire | Taille indicative | Besoin à vérifier |
|---|---:|---|
| Prestataires de services, artisans et indépendants | 5 entreprises | Devis, factures, suivi client et relances |
| Commerces et petites boutiques | 5 entreprises | Clients, produits, ventes, factures et dépenses |

Ce partage est une hypothèse de recrutement, pas une conclusion sur le meilleur marché. Éviter au premier tour les organisations qui exigent des intégrations, une consolidation multi-sociétés ou des règles comptables nationales non encore validées.

### 3.2 Grille de sélection

Noter chaque prospect de 1 à 5 sur les critères suivants :

- fréquence du problème de facturation ;
- volonté de consacrer 30 à 45 minutes au démarrage ;
- disponibilité pour deux retours pendant les 14 jours ;
- adéquation entre ses besoins et les fonctions déjà testées ;
- capacité à décider ou à faire décider l'achat.

Privilégier les entreprises qui ont un problème réel et acceptent de donner un retour honnête, pas uniquement les proches prêts à encourager le projet.

### 3.3 Fiche prospect minimale

Conserver uniquement les informations utiles au suivi commercial :

| Champ | Exemple de valeur |
|---|---|
| Identifiant pilote | PIL-001 |
| Segment | Prestataire / commerce |
| Activité | Description courte |
| Contact autorisé | Nom et canal convenu |
| Situation actuelle | Cahier, tableur, autre logiciel |
| Volume déclaré | Fourchette de factures par mois |
| Problème prioritaire | Description avec les mots du prospect |
| Prochaine action | Entretien, démo, onboarding, suivi |
| Statut | À contacter, qualifié, pilote, actif, sorti |
| Consentement au suivi | Oui / non, date et canal |

Ne collecter ni pièce d'identité, ni coordonnées bancaires, ni données client finales pour remplir cette fiche.

## 4. Entretien de découverte — 20 minutes

L'objectif est de comprendre les pratiques actuelles avant de présenter le logiciel. Poser des questions ouvertes et noter les réponses exactes.

1. Comment préparez-vous actuellement un devis ou une facture ?
2. Quelles étapes vous prennent le plus de temps ?
3. Comment retrouvez-vous les factures en attente ou en retard ?
4. Comment suivez-vous les paiements partiels et les dépenses ?
5. Quelles erreurs ou oublis se produisent le plus souvent ?
6. Quels outils utilisez-vous déjà et qu'est-ce qui vous ferait les abandonner ?
7. Qui prépare les documents et qui valide les paiements ?
8. Quelles informations doivent absolument apparaître sur vos documents ?
9. Qu'est-ce qui vous empêcherait d'essayer un nouvel outil ?
10. Comment décideriez-vous de payer pour un outil de ce type ?

Ne pas commencer par « Aimeriez-vous notre application ? ». Une approbation polie n'est pas une preuve de besoin ou de volonté de payer.

À la fin seulement, proposer une démonstration de 10 à 15 minutes avec un scénario adapté à l'activité.

## 5. Démonstration standardisée

Utiliser le même parcours pour pouvoir comparer les retours :

1. créer ou ouvrir une entreprise de démonstration ;
2. ajouter un client fictif ;
3. ajouter un produit ou une prestation fictive ;
4. créer un devis ;
5. transformer le devis en facture si ce parcours est nécessaire ;
6. afficher le statut et le solde d'une facture ;
7. enregistrer un règlement fictif uniquement pour expliquer le suivi ;
8. afficher les dépenses ou le rapport correspondant ;
9. montrer l'impression ou l'export PDF et contrôler le rendu.

Demander au participant de réaliser lui-même les actions principales. Mesurer les hésitations et les demandes d'aide ; ne pas faire toute la démonstration à sa place.

Ne pas présenter comme disponibles les modules, intégrations, automatisations, moyens de paiement ou fonctions Entreprise qui n'ont pas été vérifiés sur la version proposée au pilote.

## 6. Onboarding et suivi sur 14 jours

| Moment | Action | Preuve à recueillir |
|---|---|---|
| Jour 0 | Présenter les conditions du pilote, vérifier l'accès et configurer le compte | Accès fonctionnel, besoins prioritaires et accord de suivi |
| Jour 1–2 | Accompagner l'ajout d'un client et la création de la première facture | Première facture créée et temps nécessaire |
| Jour 3 | Demander ce qui a bloqué ou nécessité de l'aide | Blocages précis, erreurs et demandes d'assistance |
| Jour 7 | Vérifier le retour dans le produit et observer une tâche réelle | Usage répété, fonction utilisée, difficulté persistante |
| Jour 10 | Tester la compréhension de l'offre et des limites | Objections, fonctions indispensables, prix compris |
| Jour 14 | Faire un entretien de bilan et décider de la suite | Décision : poursuivre, corriger, convertir ou arrêter |

L'indicateur d'activation principal est celui du plan d'entreprise : **un client ajouté et une première facture créée**. Une inscription ou une connexion seule ne vaut pas activation.

## 7. Mesures à suivre

Enregistrer des nombres et des faits vérifiables, sans transformer les objectifs ci-dessous en résultats annoncés.

| Indicateur | Définition |
|---|---|
| Prospects contactés | Entreprises auxquelles une proposition personnalisée a été envoyée |
| Entretiens réalisés | Découvertes terminées, hors échanges de courtoisie |
| Démonstrations terminées | Parcours standard présenté au prospect |
| Activation | Client ajouté et première facture créée |
| Délai d'activation | Temps entre le premier accès et la première facture |
| Usage répété | Participant qui revient effectuer une tâche utile après l'activation |
| Assistance | Nombre de demandes et temps consacré par pilote |
| Blocage critique | Erreur qui empêche de facturer, expose les données ou fausse un montant |
| Intention de paiement | Réponse précise à une offre et à des conditions explicites |
| Conversion payante | Paiement réellement confirmé selon le mode de vente effectivement disponible |

### Seuils exploratoires proposés pour cette cohorte

Ces seuils sont des règles de décision internes à tester ; ils ne sont pas des références sectorielles :

- au moins 8 pilotes sur 10 capables de créer une première facture avec un accompagnement limité ;
- au moins 5 pilotes sur 10 qui reviennent effectuer une action utile pendant la deuxième semaine ;
- au moins 3 pilotes sur 10 qui expriment une volonté de paiement crédible après présentation du prix, du contenu de l'offre et des conditions ;
- aucun blocage critique non corrigé concernant l'isolation des comptes, les montants, les documents ou la confidentialité.

Si ces seuils ne sont pas atteints, prolonger ou redéfinir le pilote plutôt que d'augmenter immédiatement le budget publicitaire.

## 8. Tester le prix sans induire le prospect en erreur

Le dépôt distingue actuellement les paiements ponctuels des formules et les abonnements récurrents envisagés dans le plan. Les montants mensuels/annuels du plan restent des hypothèses tant qu'un système d'abonnement avec renouvellement, résiliation, impayés et consentement n'est pas livré et testé.

Pendant le pilote :

1. demander d'abord quelle solution le prospect utilise et combien elle lui coûte en temps ou en argent ;
2. présenter une seule offre à la fois, avec son prix, ses limites et ses conditions ;
3. demander ce qu'il achèterait réellement, ce qui lui manquerait et pourquoi il refuserait ;
4. consigner les réponses sans les comptabiliser comme du chiffre d'affaires ;
5. ne proposer une transaction réelle que si le mode de vente correspondant est opérationnel, autorisé et expliqué sans ambiguïté ;
6. ne jamais présenter un paiement unique comme un abonnement, ni annoncer un renouvellement automatique qui n'existe pas.

Un test d'intérêt pour un tarif mensuel n'autorise pas à prélever mensuellement le participant.

## 9. Suivi commercial hebdomadaire

Utiliser un tableau simple, avec une ligne par entreprise et une revue chaque semaine.

| ID | Segment | Étape | Activé | Usage semaine 2 | Blocage principal | Temps support | Intention de paiement | Prochaine action |
|---|---|---|---|---|---|---:|---|---|
| PIL-001 | Prestataire | Démo | Non | Non applicable | À renseigner | 0 min | À vérifier | Date de suivi |

Chaque revue doit répondre à cinq questions :

- Quel problème revient le plus souvent ?
- À quel moment les participants demandent-ils de l'aide ?
- Quelle correction débloquerait le plus d'utilisateurs ?
- Quels participants sont revenus spontanément ?
- Quelle hypothèse commerciale a été confirmée ou réfutée ?

Classer les retours par fréquence, gravité et impact sur l'activation. Corriger d'abord les erreurs qui empêchent de créer une facture, les erreurs de calcul, les problèmes de données et les défauts d'accès.

## 10. Messages de suivi

### Invitation personnalisée

> Bonjour, je développe SUNUPILOT, un outil de gestion des devis, factures et suivis clients destiné aux petites entreprises. Je cherche quelques entreprises au Sénégal pour tester un parcours concret et recueillir des retours francs. Seriez-vous disponible pour un échange de 20 minutes et, si cela correspond à vos besoins, une démonstration sans engagement ?

### Après la démonstration

> Merci pour votre temps. Le point que je retiens de notre échange est : [problème exprimé par la personne]. Je vous propose de tester uniquement le parcours [parcours convenu], puis de refaire un point le [date]. Vous pouvez arrêter le test à tout moment selon les conditions que nous avons présentées.

### Demande de témoignage

> Votre retour nous serait utile. Accepteriez-vous que nous citions votre commentaire au sujet de SUNUPILOT ? Nous vous montrerons le texte exact et demanderons votre accord avant toute publication. Vous pouvez refuser sans conséquence sur votre participation.

Personnaliser les messages, respecter tout refus et ne pas envoyer de relances répétées à une personne qui ne souhaite plus être contactée.

## 11. Décision à la fin du pilote

### GO — passer à une commercialisation limitée

Seulement si :
- les parcours essentiels ont été testés sur l'environnement réellement proposé ;
- les critères d'activation et d'usage répété sont suffisamment encourageants ;
- aucun défaut critique de sécurité, de calcul ou de confidentialité n'est ouvert ;
- les conditions de vente et de paiement correspondent exactement au fonctionnement du produit ;
- le support peut traiter les demandes observées.

### ITERATE — prolonger et corriger

Choisir cette option si les utilisateurs comprennent la valeur mais rencontrent des difficultés reproductibles, si le prix reste incompris ou si un segment réagit nettement mieux qu'un autre.

### STOP — suspendre les accès pilotes concernés

Suspendre immédiatement en cas de fuite de données, accès inter-entreprises, calcul financier erroné, suspicion de compromission, perte de données ou paiement confirmé sans état cohérent dans l'application. Préserver les éléments nécessaires à l'analyse et suivre la procédure d'incident.

## 12. Planning d'exécution sur 30 jours

| Période | Travail | Livrable |
|---|---|---|
| Jours 1–5 | Terminer les prérequis, sélectionner 20 à 30 prospects, préparer les données fictives | Liste qualifiée et environnement de démonstration |
| Jours 6–10 | Réaliser les entretiens et choisir les 10 pilotes | Synthèse des besoins et cohorte retenue |
| Jours 11–24 | Onboarder, suivre les usages à J3/J7/J14 et corriger les blocages | Journal pilote et tableau d'indicateurs |
| Jours 25–27 | Entretiens de bilan et test de compréhension des offres | Synthèse des retours et prix à retester |
| Jours 28–30 | Revue GO / ITERATE / STOP et décision du prochain segment | Décision documentée et backlog priorisé |

Les dates de calendrier doivent être fixées par le responsable du lancement après validation des prérequis techniques. Le planning ne doit pas conduire à ouvrir des comptes réels avant que les contrôles bloquants soient terminés.

## 13. Compte rendu final du pilote

À la clôture, renseigner :

- nombre de prospects contactés ;
- entretiens et démonstrations réalisés ;
- pilotes réellement activés ;
- participants revenus pendant la deuxième semaine ;
- temps moyen et total consacré à l'assistance ;
- cinq problèmes les plus fréquents ;
- fonctions demandées mais non disponibles ;
- réactions aux offres et prix présentés ;
- incidents et défauts corrigés ;
- décision GO / ITERATE / STOP, avec responsable et date.

Ne publier aucun chiffre commercial avant d'avoir les données vérifiables correspondantes. Une cohorte pilote n'est pas une preuve de conformité, de rentabilité ou de disponibilité internationale.