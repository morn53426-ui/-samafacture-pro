# Internationalisation — périmètre actuel et tâches restantes

## Couverture présente dans cette branche

- **Pays** : les 54 États africains, les principaux marchés européens et les options historiques États-Unis/Canada sont proposés dans les paramètres.
- **Devises** : les codes de référence africains et européens courants sont disponibles, notamment XOF, XAF, NGN, GHS, KES, ZAR, EUR, GBP, CHF, USD et CAD. `FCFA` reste accepté comme alias historique ; choisir XOF ou XAF permet de distinguer les deux zones CFA.
- **Fuseaux horaires** : la liste des fuseaux IANA africains et européens, ainsi que les principaux fuseaux nord-américains, est centralisée et testée par le runtime `Intl`.
- **Noms des pays** : les libellés suivent le français ou l'anglais choisi dans les paramètres.
- **Dates et montants** : le formateur partagé utilise `Intl`, le format de date de l'entreprise et son fuseau horaire. Les colonnes SQL `DATE` restent des dates civiles et ne subissent pas de décalage de jour ; les valeurs `DATETIME` sont interprétées comme UTC puis affichées dans le fuseau du compte.
- **Calendrier métier** : les échéances récurrentes, leur jour d'ancrage, les dates d'émission par défaut, le quota mensuel gratuit, les statuts du tableau de bord, les relances automatiques et les dates de secours de plusieurs documents Pro utilisent le calendrier civil du compte.
- **Numérotation** : les créations, conversions de devis, duplications et générations récurrentes choisissent l'année de numérotation selon la date locale de l'entreprise.

## Limites à ne pas présenter comme déjà résolues

1. **Traduction de l'interface** — le paramètre de langue propose français et anglais et actualise les noms de pays ; toutes les pages et tous les textes métier ne sont pas encore traduits. Les traductions complètes doivent être extraites dans des catalogues de messages et testées écran par écran.
2. **Conversion de devises** — l'application stocke les codes et formate les montants ; elle ne récupère pas de taux de change, ne convertit pas automatiquement les factures et ne fait pas de consolidation multi-devises. La devise de base est verrouillée après l'utilisation de montants, afin de ne pas réinterpréter l'historique.
3. **Fiscalité** — le champ « régime fiscal » est indicatif. Il n'applique ni ne certifie les règles TVA, retenues, numérotation légale ou mentions obligatoires des pays. Une configuration fiscale par pays doit être validée par un professionnel local.
4. **Légal et protection des données** — les formalités CDP au Sénégal, le RGPD/les transferts UE, les sous-traitants, la résidence des données et les durées de conservation doivent être confirmés pour chaque offre et pays de commercialisation.
5. **Formats de paiement et facturation** — Wave/PayDunya, les paiements de plans et les modes de règlement doivent être vérifiés par pays. Les plans SaaS restent des paiements ponctuels dans l'intégration actuelle, pas des abonnements récurrents.
6. **Rapports et exports** — valider l'affichage des montants, dates, séparateurs décimaux, fichiers PDF/Excel et regroupements de périodes autour de minuit, des fins de mois et des changements d'heure.

## Recette de lancement par marché

Pour chaque pays activé : créer une entreprise de test avec le pays, la devise et le fuseau correspondants ; créer une facture, un devis, un paiement, une échéance récurrente, un avoir et une dépense ; vérifier PDF, email, exports et rapports ; tester une date de fin de mois, un changement de mois/année et, pour l'Europe, une transition d'heure d'été/hiver. Faire valider la fiscalité et les documents légaux par un professionnel local avant d'activer la vente dans ce pays.

**État de l'audit :** la base technique des paramètres et du calendrier multi-fuseaux est renforcée dans cette branche. Cela ne constitue pas une certification de localisation complète ni une validation juridique/fiscale pour les pays listés.
