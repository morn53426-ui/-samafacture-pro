# Plan d’entreprise — SUNUPILOT

**Version :** 0.2 — 16 novembre 2026  
**Statut :** document de travail stratégique — hypothèses à valider avec des clients  
**Marché de départ recommandé :** Sénégal  
**Ambition :** construire un SaaS de gestion commerciale adapté aux petites entreprises d’Afrique francophone, puis aux entreprises francophones d’Europe.

---

## 1. Résumé exécutif

SUNUPILOT est une plateforme web de facturation et de gestion commerciale destinée aux indépendants, commerçants, prestataires de services et petites et moyennes entreprises. Le produit réunit dans un même espace la gestion des clients et produits, les devis, les factures, les paiements enregistrés, les dépenses, les rapports et des fonctions professionnelles.

L’opportunité commerciale consiste à simplifier le quotidien des entreprises qui utilisent encore des documents manuels, des feuilles de calcul ou plusieurs outils séparés. La promesse doit rester concrète : **créer un devis, le transformer en facture, suivre les règlements et connaître l’activité sans multiplier les fichiers**.

La stratégie proposée est progressive :

1. lancer proprement au Sénégal ;
2. accompagner personnellement les 10 premiers utilisateurs pilotes ;
3. convertir les premiers utilisateurs payants et atteindre 30 clients actifs ;
4. répéter les canaux qui fonctionnent pour viser 100 clients ;
5. adapter ensuite le produit et le support à un pays d’Afrique francophone à la fois ;
6. aborder l’Europe lorsque la conformité, les devises, la fiscalité et les paiements de cette zone auront été validés.

Le modèle cible est un **SaaS facturé mensuellement ou annuellement**. Attention : le code actuellement présent dans le dépôt ne réalise pas encore des prélèvements récurrents ni une expiration automatique des accès. Les paiements de plans existants sont ponctuels. La mise en place d'une véritable facturation récurrente est donc un chantier préalable à la commercialisation sous forme d'abonnement automatique.

Aucun nombre de clients, chiffre d'affaires, taux de conversion ou coût d'acquisition n'est présenté ici comme un résultat réel. Les chiffres commerciaux ci-dessous sont des objectifs et simulations de travail.

## 2. Le problème client et la proposition de valeur

### Problèmes à résoudre

- Création manuelle de devis et factures, avec risque d'erreurs de calcul ou de numérotation.
- Difficulté à savoir quels clients doivent encore de l'argent.
- Informations dispersées entre cahiers, feuilles de calcul, messageries et outils différents.
- Manque de visibilité sur les ventes, les dépenses et les paiements.
- Outils qui ne correspondent pas toujours aux habitudes locales : FCFA, paiements mobiles, langue française et documents adaptés à l'entreprise.

### Proposition de valeur

**SUNUPILOT aide une entreprise à gérer ses ventes et ses documents commerciaux depuis un seul espace, avec des outils adaptés à son activité et à son pays.**

Messages à tester pendant les démonstrations :

- « Préparez votre devis et votre facture en quelques minutes. »
- « Retrouvez les factures payées, en attente et en retard. »
- « Suivez vos clients, vos produits, vos dépenses et vos ventes au même endroit. »
- « Partagez vos documents avec vos clients et gardez un historique. »

Ne pas promettre une fonctionnalité avant qu'elle soit réellement opérationnelle et testée dans l'offre vendue.

## 3. Produit : état actuel et limites à traiter

### Socle déjà décrit dans le dépôt

Le README et la documentation des modules décrivent notamment :

- comptes utilisateurs et authentification ;
- clients, produits, devis et factures ;
- calculs de TVA, remises, livraison et totaux ;
- paiements enregistrés et suivi du solde ;
- dépenses et rapports ;
- modèles de factures et devis ;
- factures récurrentes, relances email et partage WhatsApp manuel ;
- documents PDF, équipe, rôles, établissements, caisses, CRM, API et webhooks dans les modules professionnels ;
- architecture Node.js / Express, MySQL, Redis et Docker.

La suite d'intégration et la recette visuelle existent dans le dépôt. Elles sont utiles pour limiter les régressions, mais ne remplacent pas une recette de production, des essais de paiement réels en environnement sandbox ou une vérification juridique.

### État de la formule Entreprise

La page public/abonnement.html affiche la formule Entreprise comme « Bientôt disponible » et mentionne des options multi-sociétés en préparation. Le backend connaît un tarif Entreprise de 35 000 FCFA, mais ce montant est actuellement un **paiement unique**, comme les tarifs Starter et Pro. La formule ne doit pas être commercialisée comme un abonnement mensuel automatique tant que la facturation récurrente et les droits correspondants ne sont pas implémentés et testés.

### Chantiers prioritaires avant une vente à grande échelle

| Priorité | Chantier | Résultat attendu |
|---|---|---|
| P0 | Vérifier sécurité, logs email, authentification et isolation des comptes | Pas de fuite de liens sensibles ; chaque client ne voit que ses données |
| P0 | Compléter les mentions légales, conditions et politique de confidentialité | Documents cohérents avec l'exploitant, les pays et les traitements réellement utilisés |
| P0 | Sauvegarde hors serveur et test de restauration | Capacité démontrée à restaurer après une panne |
| P0 | Stabiliser paiements, webhooks, remboursements et rapprochement | Paiements confirmés côté serveur et états compréhensibles par le client |
| P1 | Mettre en place la facturation mensuelle/annuelle | Date de début, échéance, renouvellement, impayé, grâce et suspension cohérents |
| P1 | Définir les droits et quotas par formule | Chaque offre donne exactement les fonctions annoncées |
| P1 | Finaliser le parcours d'accueil et l'aide dans l'application | Un nouvel utilisateur réalise sa première facture sans assistance directe |
| P1 | Mesurer performances et disponibilité | Suivi des erreurs, temps de réponse, sauvegardes et incidents |

Les audits déjà présents dans le dépôt signalent des points de conformité et de sécurité à revalider sur la tête actuelle de main avant le lancement public. Les rapports sont des constats datés, pas une certification actuelle.

## 4. Clients cibles

### Segment A — Commerçants et petites boutiques

Besoins : clients, produits, devis, factures, suivi des paiements et dépenses.  
Offre d'entrée : Starter.  
Canal d'acquisition : visite terrain, recommandations, WhatsApp et associations locales.

### Segment B — Prestataires et indépendants

Exemples : consultants, réparateurs, agences, artisans, prestataires informatiques et professionnels de services.  
Besoins : devis rapides, factures personnalisées, suivi client et relances.  
Offre d'entrée : Starter ou Pro.

### Segment C — PME avec plusieurs collaborateurs

Besoins : rôles, partage du travail, suivi de plusieurs activités, rapports et procédures.  
Offre cible : Entreprise, après validation de la gestion multi-sociétés et des limites d'accès.

### Segment D — Cabinets comptables et partenaires

Besoins : accompagner plusieurs petites entreprises, organiser les documents et aider à suivre les factures.  
Piste commerciale : partenariat, démonstration groupée et accompagnement des clients du cabinet. Toute offre multi-dossiers doit être conçue avec des droits et une isolation appropriés ; ne pas assimiler un accès membre existant à un véritable portail comptable multi-clients.

## 5. Modèle économique recommandé

### Modèle cible

- **SaaS mensuel** : revenu récurrent et accès maintenu tant que le paiement est à jour.
- **SaaS annuel** : paiement anticipé avec remise éventuelle, après mise en place des dates d'expiration et renouvellements.
- **Services complémentaires** : installation, import initial des données, formation, personnalisation et assistance dédiée.
- **Contrats Entreprise** : devis après cadrage du nombre d'entités, utilisateurs, accompagnement et intégrations.

Le modèle SaaS est recommandé comme modèle principal. La licence perpétuelle peut rester une offre distincte pour des besoins particuliers, mais elle doit être séparée clairement du service hébergé, de la maintenance, des sauvegardes et du support.

### Grille tarifaire à tester — non encore activée comme abonnement

| Offre | Prix mensuel indicatif | Client visé | Positionnement |
|---|---:|---|---|
| Gratuit | 0 FCFA | Découverte | Jusqu'à 10 factures/mois selon la limite existante |
| Starter | 5 000 FCFA | Indépendant et petit commerce | Facturation et gestion de base |
| Pro | 10 000 FCFA | Activité structurée | Outils avancés et rapports |
| Entreprise | À partir de 25 000 FCFA | PME et équipes | Utilisateurs, gouvernance, besoins multi-entités et accompagnement, après validation des fonctions |

Ces montants sont des **hypothèses commerciales à tester**, et non les tarifs récurrents actuellement codés. Le backend expose actuellement des montants ponctuels de 5 000, 15 000 et 35 000 FCFA pour Starter, Pro et Entreprise. Avant tout changement des tarifs visibles, aligner la page, l'API, les conditions d'achat, les tests et le système de paiement.

### Principes de construction des formules

- Définir les limites en fonction de la valeur et du coût réel de service, pas seulement du nom du plan.
- Ne pas faire payer deux fois une fonction annoncée comme incluse.
- Garder les données du client accessibles en lecture/export après un impayé, selon des règles annoncées et juridiquement validées.
- Prévoir une procédure de résiliation et de récupération des données.
- Ne pas activer de prélèvement automatique sans consentement clair et vérification du cadre du fournisseur de paiement.

## 6. Marché et ordre d'expansion

### Étape 1 — Sénégal

Objectif : prouver que des entreprises utilisent le produit chaque semaine et acceptent de payer pour le service.

Priorités :
- interface et assistance en français ;
- XOF et paramètres locaux correctement appliqués ;
- paiements compatibles avec les moyens réellement disponibles et autorisés ;
- factures et mentions adaptées aux exigences locales, après validation par un professionnel compétent ;
- support en heures ouvrées et documentation simple.

### Étape 2 — Afrique de l'Ouest francophone

Pays candidats à étudier après validation du Sénégal : Côte d'Ivoire, Bénin, Togo, Mali et Burkina Faso.

Pour chaque pays, réaliser une fiche locale avant de vendre :
1. devise et règles de conversion ;
2. règles fiscales et mentions des factures ;
3. prestataires de paiement et modalités de remboursement ;
4. langues, formats de date et fuseaux horaires ;
5. conditions commerciales et protection des données ;
6. assistance locale, prix acceptable et concurrents.

Ne pas activer tous les pays simultanément. Choisir le prochain pays à partir des demandes entrantes, de la facilité de paiement, des adaptations obligatoires et du coût du support.

### Étape 3 — Europe francophone

Commencer par étudier la France et la Belgique, sans annoncer une conformité européenne avant audit.

Chantiers spécifiques :
- TVA et mentions fiscales selon le pays et le type de client ;
- conformité RGPD, contrats de sous-traitance, droits des personnes et transferts de données ;
- politique de conservation et suppression ;
- hébergement et sauvegardes adaptés aux engagements annoncés ;
- paiements en EUR et moyens de paiement compatibles ;
- formats, traductions, support et documentation ;
- étude des obligations de facturation électronique applicables et de leur calendrier avant toute promesse commerciale.

L'internationalisation n'est pas seulement une traduction : elle implique le droit, la fiscalité, le paiement, la sécurité, la monnaie, le support et la distribution.


### État réel de l'internationalisation — contrôle du code du 16 novembre 2026

Les réglages techniques constituent une première base, mais ne signifient pas que le produit est déjà prêt à être commercialisé dans tous les pays.

| Domaine | Base présente dans le dépôt | Limite à traiter avant une ouverture internationale |
|---|---|---|
| Pays, devises et fuseaux | Listes de pays, de codes de devises et de fuseaux IANA dans `server/config/localization.js`, avec paramètres par entreprise | Une option dans une liste ne valide ni les obligations locales, ni la disponibilité d'un prestataire, ni l'adéquation juridique d'une facture |
| Langue | Les préférences enregistrées et les formats prennent en charge le français et l'anglais | Le choix de langue ne traduit pas encore toute l'interface. Les libellés des pages restent largement en français ; les catalogues complets de traduction, les emails, l'aide et les documents multilingues restent à construire. Le portugais et l'arabe ne sont pas proposés |
| Dates et nombres | Les dates et nombres s'appuient sur les paramètres régionaux et les fuseaux horaires | Chaque pays et ses changements d'heure doivent être testés sur les écrans, les PDF, les emails et les tâches planifiées |
| Devise | Une devise par défaut est enregistrée pour l'entreprise ; les anciens documents conservent leur devise | Le changement de devise de base est refusé dès qu'un historique commercial ou financier existe. Aucune conversion automatique ni consolidation comptable multidevise ne doit être promise sans chantier dédié |
| Fiscalité | Un paramètre de régime fiscal générique est proposé | Les choix « standard », « simplifié », « franchise » et « autre » ne constituent pas un moteur fiscal national. TVA, numérotation réglementaire, identifiants fiscaux, mentions obligatoires et facturation électronique nécessitent des profils validés pays par pays |

**Conséquence commerciale :** ne pas présenter SUNUPILOT comme « disponible dans toute l'Afrique et l'Europe » au seul motif que des pays, devises et fuseaux apparaissent dans les paramètres. Le premier marché commercial reste le Sénégal ; chaque extension doit être explicitement activée après validation produit, fiscale, juridique, paiement et support.

### Chantiers produit à ordonner pour l'international

1. **Internationalisation de l'interface :** introduire un catalogue de messages centralisé, une langue par utilisateur, un mécanisme de repli français, puis faire traduire et tester les écrans, notifications, emails, documents PDF, onboarding et centre d'aide. Prioriser le français et l'anglais ; évaluer ensuite portugais et arabe selon la demande réelle. Prévoir l'affichage RTL avant d'annoncer l'arabe.
2. **Profils pays :** maintenir pour chaque pays les identifiants fiscaux, règles de TVA, mentions de facture, règles d'arrondi, formats et obligations de conservation, avec validation d'un professionnel local.
3. **Monnaies et comptabilité :** distinguer devise par défaut, devise d'un document et devise de règlement ; stocker les montants et taux appliqués à la date de transaction ; ne jamais convertir rétroactivement un historique sans écriture comptable explicite.
4. **Paiements locaux :** vérifier pour chaque pays les prestataires, devises effectivement encaissables, frais, remboursements, délais de règlement et procédures de rapprochement.
5. **Validation de marché :** conduire des entretiens et pilotes dans le pays ciblé avant d'ouvrir les inscriptions payantes ; mesurer les clients actifs, la volonté de payer, le coût du support et les demandes non couvertes.

Le lancement dans un pays supplémentaire est conditionné à une fiche de validation signée par le responsable produit et les conseils locaux : langue, devise, fiscalité, paiement, données personnelles, contrats, support, sauvegardes et procédures de remboursement.

## 7. Plan d'acquisition des 100 premiers clients

### Phase A — 10 utilisateurs pilotes

Objectif : observer les usages réels et corriger les blocages avant de dépenser beaucoup en publicité.

Actions :
- dresser une liste de 50 commerces, indépendants, prestataires et petites PME accessibles au Sénégal ;
- contacter personnellement 10 à 15 prospects ciblés par jour ouvré ;
- poser des questions sur leur méthode actuelle, leurs difficultés, le volume de factures et leurs moyens de paiement ;
- proposer une démonstration de 15 minutes avec des données fictives ;
- accompagner 10 entreprises pilotes pendant leur première facture ;
- demander un retour précis après 7 et 14 jours.

Critère de passage : au moins 5 pilotes utilisent le produit de façon répétée et les principaux blocages sont corrigés.

### Phase B — 30 clients payants

Actions :
- obtenir l'autorisation de publier 2 ou 3 témoignages vérifiables ;
- créer une vidéo de démonstration de 60 à 90 secondes ;
- publier des cas concrets : création d'un devis, transformation en facture, suivi du solde ;
- lancer un programme de recommandation simple et traçable ;
- proposer une formation de démarrage aux nouveaux clients ;
- contacter les cabinets comptables et consultants qui accompagnent les PME.

Critère de passage : suivre chaque semaine les essais, premières factures, conversions payantes, paiements échoués et résiliations.

### Phase C — 100 clients

Actions :
- répéter les deux canaux qui produisent les clients payants au coût le plus faible ;
- créer des pages dédiées à chaque métier ou segment ;
- construire un réseau de partenaires apporteurs d'affaires avec conditions écrites ;
- améliorer l'intégration autonome pour réduire le temps d'assistance ;
- développer les recommandations à partir des clients satisfaits ;
- tester une campagne publicitaire avec petit budget et suivi des conversions.

### Routine commerciale hebdomadaire de départ

| Activité | Cible de travail |
|---|---:|
| Nouveaux prospects qualifiés contactés | 50 |
| Échanges de découverte | 10 |
| Démonstrations réalisées | 5 |
| Nouveaux essais accompagnés | 3 à 5 |
| Suivis des essais en cours | Tous les essais actifs |
| Analyse des objections et conversions | 1 revue hebdomadaire |

Ces chiffres sont un rythme de prospection à tester, pas une garantie de conversion. Ajuster les objectifs avec les résultats observés.

### Exemple de premier message

> Bonjour, je vous contacte parce que je développe SUNUPILOT, un outil qui aide les petites entreprises à créer leurs devis et factures, suivre les paiements et organiser leurs clients.
>
> Je cherche quelques entreprises pour tester la solution et me dire franchement ce qui leur serait utile. Est-ce que je pourrais vous présenter une démonstration de 15 minutes, sans engagement ?

Ne pas envoyer de messages massifs non sollicités. Personnaliser le contact, respecter les refus et demander l'accord avant d'utiliser le nom ou le témoignage d'un client.

## 8. Parcours commercial et fidélisation

Le parcours cible est :

1. découverte par recommandation, recherche, contenu ou partenaire ;
2. page publique qui présente clairement les fonctions, tarifs, conditions et limites ;
3. démonstration ou essai ;
4. création de compte et configuration guidée ;
5. première facture créée ;
6. premier paiement du client final enregistré ;
7. conversion vers une formule payante ;
8. aide, suivi d'utilisation et renouvellement ;
9. recommandation à une autre entreprise.

L'indicateur d'activation principal devrait être : **le nouvel utilisateur a créé sa première facture et ajouté au moins un client**. Une inscription seule ne constitue pas une activation.

Prévoir une assistance claire : centre d'aide, formulaire support, réponse aux problèmes de paiement, export des données et procédure d'incident.

## 9. Prévisions financières — scénarios, pas prévisions garanties

Avec un revenu mensuel moyen hypothétique de 10 000 FCFA par client :

| Clients payants | Chiffre d'affaires mensuel | Équivalent annuel |
|---:|---:|---:|
| 10 | 100 000 FCFA | 1 200 000 FCFA |
| 30 | 300 000 FCFA | 3 600 000 FCFA |
| 100 | 1 000 000 FCFA | 12 000 000 FCFA |
| 300 | 3 000 000 FCFA | 36 000 000 FCFA |
| 500 | 5 000 000 FCFA | 60 000 000 FCFA |

Ces montants sont du chiffre d'affaires brut théorique avant frais de paiement, hébergement, emails/SMS, support, acquisition, personnel, taxes, remboursements et impayés. Ils ne constituent pas un bénéfice.

### Tableau de bord financier à mettre en place

- MRR : revenu mensuel récurrent réellement encaissé ou reconnu selon une méthode comptable cohérente.
- ARR : revenu récurrent annualisé.
- ARPA : revenu moyen par compte payant.
- Taux essai vers payant.
- Churn : clients perdus sur le mois.
- CAC : coût d'acquisition d'un client payant.
- Délai de récupération du CAC.
- Impayés et paiements échoués.
- Marge après coûts variables et support.

Ne pas calculer MRR/ARR à partir de paiements uniques sans date de service et règle comptable appropriées.

## 10. Budget et gestion de trésorerie

Les coûts réels du VPS, du domaine, de la messagerie, du stockage, des prestataires de paiement et de la publicité doivent être relevés à partir des factures effectives.

Créer un budget mensuel avec ces postes :
- infrastructure, domaine, sauvegardes et monitoring ;
- fournisseurs de paiement et frais de transaction ;
- emails, SMS et support ;
- publicité et prospection ;
- outils de travail et comptabilité ;
- accompagnement juridique/comptable ;
- rémunération et temps de support du fondateur.

Règle de gestion : séparer les recettes encaissées, les taxes à provisionner, les frais fournisseurs et l'argent disponible pour financer la croissance. Conserver une réserve d'exploitation avant d'augmenter les dépenses publicitaires ou les recrutements.

## 11. Organisation et responsabilités

Au démarrage, une petite équipe peut couvrir plusieurs fonctions, mais les responsabilités doivent être explicites :

- **Direction produit** : priorités, prix, retours clients et stratégie.
- **Technique** : qualité, sécurité, incidents, sauvegardes et déploiements.
- **Commercial** : prospection, démonstrations, suivi des essais et partenariats.
- **Support / succès client** : accueil, formation, demandes et prévention des résiliations.
- **Comptabilité / juridique** : facturation de l'éditeur, fiscalité, contrats et conformité.

Le fondateur peut assumer plusieurs rôles au départ. Il faut néanmoins documenter les procédures pour éviter que toutes les opérations dépendent d'une seule personne.

## 12. Feuille de route de lancement sur 90 jours

### Jours 1 à 15 — Préparer un lancement sûr

- terminer les corrections de sécurité et de conformité prioritaires ;
- faire une sauvegarde indépendante et tester une restauration ;
- vérifier les paramètres de production et le domaine HTTPS ;
- tester les paiements en sandbox, les webhooks et les scénarios d'échec ;
- valider les textes commerciaux et les conditions ;
- préparer la démo, la vidéo courte et les scripts de prospection.

**Livrable :** version de préproduction validée, offre lisible et parcours d'essai opérationnel.

### Jours 16 à 30 — Pilote Sénégal

- interroger au moins 10 entreprises ;
- accompagner 10 pilotes maximum ;
- enregistrer les problèmes et demandes ;
- vérifier le temps d'onboarding ;
- corriger les obstacles qui empêchent de créer la première facture.

**Livrable :** rapport pilote avec usages réels, retours et décision sur les prix.

### Jours 31 à 60 — Première traction

- convertir les pilotes satisfaits en clients payants ;
- viser un premier palier de 30 clients ;
- tester recommandations et partenariats ;
- suivre les paiements et résiliations ;
- améliorer les supports de formation.

**Livrable :** premiers revenus récurrents mesurés et canaux de vente évalués.

### Jours 61 à 90 — Répéter et préparer l'international

- travailler vers 50 à 100 clients selon les conversions observées ;
- choisir un seul pays d'expansion à étudier ;
- rédiger sa fiche devise/fiscalité/paiement/données ;
- planifier les adaptations avant d'y encaisser des paiements ;
- établir un budget et un calendrier de déploiement par pays.

**Livrable :** plan d'expansion validé par des signaux clients, pas seulement par une ambition géographique.

## 13. Risques et réponses

| Risque | Réponse |
|---|---|
| Peu de clients après le lancement | Entretiens, pilotes, démonstrations personnalisées et mesure des objections |
| Produit complexe pour un débutant | Onboarding guidé, aide courte et première facture accompagnée |
| Paiement confirmé mais formule non activée | Webhooks idempotents, vérification serveur et suivi des écarts |
| Frais de paiement trop élevés | Comparer plusieurs fournisseurs et intégrer les frais au prix |
| Perte ou fuite de données | Isolation des comptes, sauvegardes externes, contrôle d'accès et tests de restauration |
| Expansion trop rapide | Ouvrir un pays à la fois après validation commerciale et réglementaire |
| Support qui devient trop coûteux | Documentation, formation, automatisation et limites contractuelles de support |
| Promesses de fonctionnalités non livrées | Grille d'offres vérifiée et publication des seules fonctions réellement disponibles |

## 14. Décisions à prendre avant d'ouvrir les ventes

Les éléments suivants nécessitent des décisions du fondateur et des validations externes :

1. identité juridique et pays d'établissement de l'éditeur ;
2. marché initial précis et segments prioritaires ;
3. prix définitifs et distinction mensuel / annuel ;
4. période d'essai, limites du gratuit et politique d'impayé ;
5. moyen de paiement disponible par pays ;
6. conditions d'annulation, remboursement et conservation des données ;
7. niveaux de support et engagements de service ;
8. pays suivant à ouvrir après le Sénégal.

Aucune règle fiscale ou juridique propre à un pays ne doit être déduite uniquement de cette note : faire valider les factures, contrats, paiements et traitements de données par les professionnels compétents dans chaque marché ciblé.

## 15. Sources internes du projet

Ce plan a été rédigé à partir des fichiers présents dans le dépôt. Les descriptions ci-dessous doivent être relues lors de chaque évolution importante du produit :

- README.md — fonctions générales, installation et architecture ;
- server/routes/abonnement.js — tarifs de plans, fournisseurs et confirmation des paiements ;
- public/abonnement.html — cartes des formules et état « bientôt disponible » de l'offre Entreprise ;
- MODULES_PROFESSIONNELS.md — périmètre et limites des modules professionnels ;
- API_PUBLIQUE.md — API et webhooks ;
- DOCKER_DEPLOIEMENT.md — déploiement, sécurité, sauvegardes et montée en charge ;
- AUDIT_CONFORMITE_20_EXIGENCES_2026-11-13.md — points de conformité à revalider ;
- RAPPORT_AUDIT_SECURITE_2026-11-15.md et RAPPORT_AUDIT_TRANSVERSAL_2026-11-15.md — constats de sécurité et d'audit datés.

---

**Conclusion :** la priorité n'est pas de lancer immédiatement dans tous les pays. La priorité est de prouver au Sénégal que des entreprises utilisent SUNUPILOT, obtiennent un bénéfice concret et paient pour continuer. Une fois ce modèle validé, l'expansion internationale pourra être financée et adaptée pays par pays.