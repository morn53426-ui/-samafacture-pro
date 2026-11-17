# Préparation conformité — Sénégal et clients de l'Union européenne

**Statut : checklist préparatoire, pas une attestation de conformité ni un avis juridique.** Aucun utilisateur réel, registre de traitement, contrat d'hébergement, lieu de stockage définitif ou responsable juridique n'a été fourni pour cet audit. Les champs qui dépendent de l'exploitant restent donc à compléter et à faire valider avant l'ouverture commerciale.

## Références officielles à examiner

- Sénégal : [Loi n° 2008-12 du 25 janvier 2008](https://www.cdp.sn/legislation/textes-legislatifs) et [décret n° 2008-721 du 30 juin 2008](https://www.cdp.sn/legislation/textes-reglementaires).
- Sénégal : [référentiel de contrôle de la CDP](https://www.cdp.sn/conformite/referentiels/controle).
- Union européenne : [guide PME de l'EDPB — responsable et sous-traitant](https://www.edpb.europa.eu/sme/learn-the-basics/data-controller-or-data-processor_en), [registre des traitements](https://www.edpb.europa.eu/sme/be-compliant/be-compliant_en) et [violations de données](https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_fr).

La portée réelle de la loi sénégalaise, du RGPD et des règles de transfert dépend du rôle de l'exploitant, de l'établissement, des personnes concernées, de l'emplacement de l'infrastructure et des traitements. Un conseil juridique doit confirmer les obligations et formalités applicables.

## 1. Inventaire technique provisoire à confirmer

Les éléments ci-dessous sont visibles dans le dépôt. Ils ne constituent pas un inventaire exhaustif des données réellement collectées en production.

| Domaine | Éléments repérés dans le code | Vérification requise |
|---|---|---|
| Compte | Nom, email, mot de passe haché, rôles, jetons JWT et cookie de session | Champs exacts, finalités et durée de conservation |
| Entreprise | Nom, adresse, téléphone, NINEA, logo et paramètres | Déterminer les données légales et celles d'éventuels dirigeants/contacts |
| Clients et facturation | Contacts clients, devis, factures, lignes, règlements et QR de consultation | Préciser les catégories de personnes et les finalités |
| Activité financière | Dépenses, montants, références et paiements | Distinguer données comptables, données bancaires et références de paiement |
| Documents | PDF générés, fichiers déposés et sauvegardes MySQL chiffrées | Localisation, accès, sauvegarde, rétention et effacement |
| File PDF | Redis Streams, identifiants, utilisateur, email, rôle, facture et statuts | Rétention du stream/PEL et des fichiers PDF orphelins |
| Journaux | Morgan, erreurs applicatives, reverse proxy, Sentry facultatif | Durée, accès, données résiduelles et procédure d'effacement |
| Services tiers | Wave, PayDunya, SMTP, Google OAuth facultatif, Sentry facultatif, CDN | Prestataires réellement activés, sous-traitants, contrats et transferts |
| Navigateur | localStorage, cookie HttpOnly, cache PWA | Inventaire des clés, durée, finalités et consentement éventuel |

## 2. Décisions obligatoires de l'exploitant — bloquantes avant lancement

- [ ] Identifier l'entité juridique exploitante : dénomination, forme, pays d'établissement, adresse, registre et identifiants pertinents.
- [ ] Nommer un contact confidentialité et confirmer si un DPO / délégué ou point focal est requis.
- [ ] Définir les rôles : responsable de traitement pour les traitements propres à SamaFacture Pro, responsable des données clients des entreprises utilisatrices, sous-traitant ou éventuelle responsabilité conjointe selon les usages.
- [ ] Fournir les pays d'hébergement de l'API, MySQL, Redis, sauvegardes, stockage de documents, SMTP, journaux et services de surveillance.
- [ ] Fournir la liste contractuelle des hébergeurs, sous-traitants et sous-traitants ultérieurs réellement utilisés.
- [ ] Choisir les durées de conservation par catégorie : comptes, documents de facturation, journaux, exports, PDF, sessions, paiements, sauvegardes et demandes support.
- [ ] Définir le processus de demande d'accès, rectification, export, opposition/limitation et suppression, en tenant compte des obligations légales de conservation comptable.
- [ ] Déterminer les bases juridiques/finalités pour chaque traitement ; ne pas utiliser un consentement générique comme base par défaut.
- [ ] Déterminer les formalités et autorisations/déclarations éventuellement nécessaires auprès de la CDP et les obligations spécifiques aux transferts hors du Sénégal ou de l'EEE.
- [ ] Faire valider les conditions d'utilisation, la politique de confidentialité, les conditions de paiement, les remboursements et les durées d'accès par un juriste connaissant les territoires ciblés.

## 3. Mesures techniques et organisationnelles à vérifier

- [ ] Registre de traitements : finalité, catégories de personnes/données, destinataires, accès, transferts, durée et mesures de sécurité.
- [ ] Contrats de sous-traitance et clauses d'instructions, confidentialité, sécurité, assistance aux droits, incidents, audits et restitution/suppression.
- [ ] Politique de conservation et effacement automatique vérifiée pour les bases, Redis, PDF, logs, exports, backups et copies externes.
- [ ] Procédure d'incident : détection, chronologie, confinement, analyse des risques, registre, notification aux autorités/personnes lorsque requise.
- [ ] Contrôles d'accès, séparation multi-entreprises, journalisation, gestion des secrets, chiffrement transport/stockage et tests de restauration.
- [ ] Analyse de risques et, si le traitement présente vraisemblablement un risque élevé, examen de la nécessité d'une analyse d'impact (DPIA/AIPD).
- [ ] Revue de la politique cookies/localStorage/PWA et des éventuels traceurs externes.
- [ ] Test du parcours d'export et de suppression d'un compte de démonstration, y compris les sauvegardes et archives qui ne peuvent pas être purgées immédiatement.

## 4. Écarts concrets visibles dans les documents actuels

- La page `public/confidentialite.html` indique qu'elle est un modèle à valider ; elle ne précise pas l'identité juridique de l'exploitant, l'adresse de contact, les lieux d'hébergement, les sous-traitants complets, les durées ou les bases juridiques.
- La politique reconnaît que l'inventaire des traceurs/stockages est incomplet.
- La page `public/conditions.html` reste elle aussi un modèle à valider et indique que les règles de remboursements/annulations doivent être complétées.
- Le README décrit un historique de sauvegardes sur volume local et recommande une copie externe ; le stockage distant indépendant doit être effectif et testé.
- Les PDF et éléments de file Redis exigent une durée de conservation et une stratégie de purge définies.
- Le statut juridique des données de clients des entreprises utilisatrices doit être décrit dans les contrats, et pas uniquement dans une politique publique générique.

## 5. Critère de sortie

Ne pas déclarer « conforme RGPD » ou « conforme CDP » sur la base de la seule présence d'une page de confidentialité ou de contrôles techniques. La clôture de ce chantier exige : inventaire validé, rôles et pays confirmés, formalités vérifiées, contrats signés, durées définies, mécanismes de droits et d'incident testés, puis validation juridique documentée.

**Responsable de validation :** exploitant / conseil juridique à désigner.  
**État de l'audit :** non clôturé — informations métier et validation humaine requises.
