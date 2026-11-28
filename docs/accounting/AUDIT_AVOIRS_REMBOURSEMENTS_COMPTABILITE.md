# Audit — intégration comptable des avoirs et remboursements

**Statut :** audit de conception, aucune modification du comportement applicatif dans cette branche.  
**Base d'analyse :** `main` au commit `a0b6da41210ecd90d61cfe470a92e1ae792542b1`.  
**Périmètre :** avoirs, remboursements, écritures automatiques et synthèse de comptabilité.

## 1. Résumé exécutif

Le cycle de remboursement d'un paiement possède déjà une logique de contre-écriture de trésorerie et de lettrage client. En revanche, le cycle des avoirs n'est pas relié au grand livre : la validation d'un avoir change uniquement son statut.

Il ne faut pas ajouter une écriture automatique à partir du seul champ `montant` avant d'avoir défini la ventilation HT/TVA et les lignes de vente concernées. Une facture peut contenir plusieurs lignes et plusieurs taux de TVA ; un montant global ne permet pas de déterminer sans ambiguïté quels comptes de produits et quelles bases de TVA doivent être corrigés.

**Décision technique recommandée :** rendre la ventilation de l'avoir explicite et immuable, puis comptabiliser sa validation dans la même transaction que le changement de statut. Les rapports doivent ensuite distinguer chiffre d'affaires, encaissements, avoirs et remboursements.

## 2. État actuel vérifié dans le code

### 2.1 Création et validation des avoirs

Fichiers et points d'entrée :
- `server/routes/professionnel.js` — `POST /credit-notes`
- `server/routes/professionnel.js` — `PUT /credit-notes/:id/status`
- `server/database/migrations/003_professional_modules.sql` — table `pro_avoirs`

Constats :
- La table `pro_avoirs` stocke actuellement `user_id`, `facture_id`, `numero`, `date_emission`, `montant`, `motif`, `statut` et `created_at`.
- Elle ne conserve pas de lignes d'avoir, de taux/base de TVA, de ventilation HT/TTC, de répartition de remise ni de compte de vente.
- La création compare le montant de l'avoir au solde calculé depuis `factures.total`. Cela suggère un montant TTC, mais le contrat de l'API ne documente pas formellement cette convention.
- La route de validation accepte `valide` ou `rejete` et met à jour le statut d'un brouillon. Elle ne crée ni écriture comptable ni événement de comptabilisation.
- Aucun verrou transactionnel n'englobe actuellement la validation du statut et un éventuel posting comptable, puisqu'il n'y a pas encore de posting d'avoir.

### 2.2 Comptabilisation des factures

Dans `server/routes/professionnel.js` :
- `buildInvoiceAccountingLines` construit les lignes à partir de `facture_lignes`.
- Les ventes sont ventilées selon les correspondances de produits/services (comptes par défaut 701/706).
- La livraison est ventilée via sa correspondance (par défaut 707).
- La TVA est actuellement portée par le total facture dans une ligne de compte 443.
- Le compte client 411 reçoit le total TTC au débit.
- `postSystemEntry` vérifie l'équilibre débit/crédit et utilise une source idempotente.
- La migration comptable définit une contrainte unique sur `(user_id, source_type, source_id)` pour une écriture automatique.

Point d'attention : la table `facture_lignes` conserve un taux `tva`, mais le builder de l'écriture de facture utilise actuellement le total agrégé `factures.total_tva`. Pour un avoir partiel qui ne porte que sur certaines lignes, la ventilation doit donc être spécifiée et vérifiée, et ne peut pas être déduite d'un simple montant de l'avoir.

### 2.3 Remboursements

Le cycle `pro_refund_requests` conserve le paiement d'origine, le montant, le motif, le statut et les références de traitement.
La comptabilisation d'un remboursement réellement exécuté :
- garantit la présence de l'écriture d'encaissement d'origine ;
- vérifie que les lignes d'origine correspondent au schéma attendu trésorerie/client ;
- poste une contre-écriture entre le compte client 411 et le compte de trésorerie (521 ou 571) ;
- effectue le posting dans la transaction de traitement du remboursement.

Cette logique traite le mouvement de trésorerie et le lettrage du paiement. Elle ne remplace pas une note de crédit sur les ventes et la TVA : ces opérations doivent rester séparées et réconciliables.

### 2.4 Synthèse de comptabilité

`server/routes/rapports.js` documente explicitement que l'endpoint `/comptabilite` :
- agrège les paiements enregistrés par date d'émission des factures ;
- additionne la TVA des factures, y compris celles annulées ;
- ne déduit actuellement ni les remboursements ni les avoirs ;
- calcule `benefice` comme paiements moins dépenses, et non comme un résultat comptable certifié.

Le contrat actuel doit rester présenté comme une synthèse simplifiée tant qu'une réconciliation à partir du journal n'est pas mise en place.

## 3. Conception recommandée

### Phase A — définir le contrat métier avant migration

Obtenir une validation métier/comptable écrite sur les points suivants :
1. Le montant saisi pour un avoir est-il toujours TTC, ou l'interface doit-elle distinguer HT, TVA et TTC ?
2. Un avoir partiel doit-il obligatoirement référencer une ou plusieurs lignes de facture, ou une réduction globale au prorata est-elle admise ?
3. Comment traiter les remises initiales, les frais de livraison, les lignes exonérées et les taux de TVA différents ?
4. Quelle est la règle lorsque la facture a déjà été payée : l'avoir crée-t-il un solde client créditeur, tandis qu'un remboursement reste une opération distincte ?
5. Quels comptes et journaux sont applicables dans le référentiel de l'entreprise et dans le contexte OHADA/local concerné ? Les comptes de démarrage du logiciel ne doivent pas être présentés comme une validation par un expert local.

Aucun code ne doit supposer les réponses à ces questions.

### Phase B — conserver une ventilation d'avoir vérifiable

Proposition de modèle, à ajuster après validation :
- Ajouter des lignes d'avoir liées aux lignes de facture d'origine.
- Conserver des instantanés immuables de la désignation, quantité, prix unitaire, remise allouée, taux de TVA, base HT, taxe et montant TTC.
- Conserver les comptes comptables et la référence de la pièce d'origine utilisés au moment de l'établissement, sans recalculer les historiques à partir de correspondances modifiées ultérieurement.
- Vérifier en centimes que la somme des lignes égale les totaux de l'en-tête.
- Empêcher qu'un avoir validé dépasse les quantités ou montants disponibles sur la facture, en tenant compte des autres avoirs non rejetés selon une règle explicitement définie.

Les anciens avoirs sans détail ne doivent pas recevoir automatiquement une ventilation inventée. Prévoir un état « à examiner / non comptabilisé » ou une procédure de reprise validée.

### Phase C — validation atomique et idempotente

Dans une seule transaction :
1. Verrouiller la facture et l'avoir dans un ordre de verrouillage documenté et cohérent avec les autres routes.
2. Vérifier le tenant, la facture source, le statut brouillon, la cohérence des lignes et les limites cumulées.
3. Vérifier si une écriture `source_type='avoir'` existe déjà.
4. Construire l'écriture inverse exacte à partir de la ventilation enregistrée et des comptes de la pièce originale.
5. Vérifier l'équilibre débit/crédit au centime et poster dans le journal choisi.
6. Passer l'avoir à `valide`, renseigner la date, l'acteur et l'identifiant de l'écriture.
7. Valider la transaction ; tout échec doit annuler à la fois le statut et l'écriture.

Un rejeu doit retourner l'écriture existante sans doubler les mouvements. Une rejection ne doit créer aucune écriture. Le posting doit être protégé contre deux validations concurrentes.

### Phase D — réconciliation et rapports

- Distinguer les ventes facturées, les ventes nettes d'avoirs, les paiements reçus et les remboursements exécutés.
- Ne pas déduire deux fois un remboursement : la contre-écriture de trésorerie ne doit pas être confondue avec une réduction du chiffre d'affaires.
- Construire les états comptables à partir des écritures validées et des dates de journal, ou renommer clairement les indicateurs simplifiés existants.
- Exposer les écarts entre sources opérationnelles et journal pour permettre un rapprochement.
- Préserver la compatibilité des clients API existants et documenter tout nouveau champ.

## 4. Tests d'acceptation requis

1. Avoir brouillon : aucune écriture comptable.
2. Avoir rejeté : aucune écriture comptable.
3. Avoir validé : une écriture équilibrée, rattachée à la facture et à l'avoir.
4. Rejeu de validation : même écriture, aucun doublon.
5. Deux validations concurrentes : une seule écriture et un seul changement de statut.
6. Avoir partiel sur facture multi-lignes et multi-taux : ventilation identique à celle approuvée.
7. Avoir sur facture avec remise et frais de livraison : allocations exactes et réconciliables.
8. Compte de vente/TVA inactif ou correspondance manquante : refus atomique, sans changement de statut.
9. Avoir cumulé au-delà du disponible : refus, y compris en concurrence.
10. Remboursement d'un paiement : inverse uniquement le mouvement de paiement ; ne crée pas une deuxième réduction du chiffre d'affaires.
11. Tenant A/B : aucune lecture ni écriture croisée.
12. Export et restauration : les détails, liens de source et identifiants d'écritures sont conservés.

## 5. Risques et limites

- Une ventilation TVA improvisée peut produire une déclaration ou un journal erroné.
- Une écriture d'avoir non idempotente peut doubler les produits, la TVA et la créance client.
- Une validation séparée du posting peut laisser un avoir déclaré valide sans écriture, ou une écriture sans statut correspondant.
- Les rapports actuels ne constituent pas une balance ou un résultat certifié.
- Le référentiel de démarrage doit être contrôlé par un professionnel compétent pour le pays et le régime fiscal de l'entreprise ; ce document ne constitue pas un avis juridique ou fiscal.

## 6. Découpage d'implémentation proposé

| Lot | Livrable | Critère de sortie |
|---|---|---|
| 1 | Contrat métier HT/TVA/TTC et règles d'allocation | Règles signées et exemples chiffrés |
| 2 | Migration et API de lignes d'avoir | Snapshots cohérents, tests de compatibilité et de restauration |
| 3 | Validation comptable atomique | Écritures équilibrées, idempotentes, concurrence couverte |
| 4 | Rapprochement remboursements/avoirs | Pas de double déduction ; historiques cohérents |
| 5 | Rapports nets et exports | Totaux réconciliés avec le grand livre |
| 6 | Recette SYSCOHADA / fiscale locale | Validation par référent comptable local documentée |

**Périmètre de cette note :** documenter les constats et le plan seulement. Aucun compte n'est modifié, aucune écriture n'est créée, aucune donnée n'est migrée et aucun paiement n'est déclenché.
