# Modèles de factures et devis — guide

Cette évolution enrichit les 15 thèmes existants sans remplacer leur identité graphique. Le rendu est partagé entre la page de détail, l'impression du navigateur et la génération PDF par Puppeteer.

## 1. Informations de l'entreprise

Depuis **Paramètres → Informations de l'entreprise**, renseignez les éléments à afficher sur vos documents :

- Nom, adresse, téléphone, email et logo (déjà disponibles).
- NINEA et RCCM.
- Site web.
- Banque et coordonnées de règlement (RIB, IBAN ou numéro de compte).
- Conditions de règlement par défaut.
- Mentions légales ou pied de page.

Les coordonnées bancaires et les mentions optionnelles ne s'affichent que lorsqu'elles sont renseignées. Les nouvelles zones de l'API préservent les valeurs enregistrées lorsqu'un ancien client n'envoie pas encore ces champs.

## 2. Informations propres à chaque document

Lors de la création d'un document, les champs suivants sont disponibles :

- **Objet / prestation** : résume la mission, la vente ou le service.
- **Référence client / bon de commande** : référence externe pour rapprocher le document avec la commande du client.
- **Conditions de règlement / validité** : texte propre au document, prioritaire sur les conditions par défaut de l'entreprise.
- **Date d'échéance** pour une facture.
- **Date de validité** pour un devis.

Les champs texte sont limités côté serveur : objet 190 caractères, référence 100 caractères et conditions 5 000 caractères. La date de validité accepte une date réelle au format ISO `YYYY-MM-DD`. La date de validité du devis est retirée lors de sa conversion en facture.

## 3. Éléments rendus sur les factures

Les modèles indiquent maintenant explicitement le prix unitaire **HT** et le montant de chaque ligne **TTC**. Quand plusieurs taux de TVA sont présents, un détail par taux affiche la base et la TVA correspondantes.

La synthèse de la facture affiche également :
- le total TTC ;
- le montant déjà réglé ;
- le reste à payer ;
- les conditions de règlement ;
- les coordonnées bancaires si elles sont renseignées ;
- les références et mentions de l'entreprise.

Le solde affiché est calculé à partir du total et du montant payé enregistré dans SamaFacture Pro. Il ne constitue pas une confirmation d'un encaissement externe.

## 4. Éléments rendus sur les devis

Les devis peuvent afficher leur date de validité, leur objet, la référence client et les conditions de l'offre. Une zone **Bon pour accord** est systématiquement ajoutée avec des emplacements pour :
- le nom et la fonction du signataire ;
- la date d'acceptation ;
- la signature et le cachet du client.

Cette zone est une zone d'acceptation à compléter par le client. Elle ne constitue pas à elle seule une signature électronique qualifiée, un horodatage certifié ou une preuve juridique de consentement.

## 5. Modèles concernés

Les ajouts sont communs aux 15 thèmes : Classique, Moderne, Minimaliste, Élégant, Corporate, Créatif, Prestige, Héritage, Diamant, Épuré, Azur, Circuit, Platine, Atelier et Saveurs.

Les préférences de thème, couleurs, polices et logo déjà configurées restent prises en charge. Les données utilisateur sont échappées avant leur insertion dans le HTML.

## 6. Mise à niveau de la base

La version de schéma de la branche de correctifs passe à **7** (les champs des documents ont été introduits dans les versions précédentes). Au démarrage, le backend ajoute de façon idempotente les colonnes de l'entreprise et du document nécessaires à ces champs. Aucune table métier existante n'est supprimée. Il est toutefois recommandé de réaliser une sauvegarde MySQL avant de déployer une migration sur une base réelle et de vérifier la mise à niveau sur une copie de staging.

## 7. Vérifications à effectuer avant production

- Créer une facture et un devis avec les champs facultatifs renseignés, puis les laisser vides.
- Tester plusieurs taux de TVA, une remise et un paiement partiel.
- Vérifier la zone d'acceptation du devis après impression et dans le PDF.
- Vérifier les coordonnées bancaires et mentions légales sur chacun des thèmes utilisés.
- Contrôler le rendu sur téléphone et ordinateur.
- Vérifier les montants et les informations dans le PDF téléchargé.

Les taxes, taux applicables, mentions obligatoires, règles de facturation et conditions juridiques varient selon la situation et le pays. Faites vérifier vos modèles par votre comptable ou conseil local avant de les utiliser comme documents fiscaux définitifs.
