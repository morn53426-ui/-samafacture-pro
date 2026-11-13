# Audit conformité — grille des 20 exigences

Date de l'audit : 13 novembre 2026
Branche examinée : feat/enterprise-pages-v2-2026-11-13
Périmètre : pages publiques, inscription/connexion, confidentialité, conditions, abonnements, API d'authentification et configuration de production.

> **Statut : NON CERTIFIÉ POUR UNE MISE EN PRODUCTION.** Cet audit technique ne constitue pas un avis juridique. Les obligations exactes dépendent notamment du pays de l'exploitant, des pays ciblés et des traitements réellement activés.

## Résumé des constats vérifiés

| Domaine | État observé | Priorité |
|---|---|---:|
| Identité de l'éditeur et mentions légales | Les pages publiques ne donnent pas l'identité juridique complète de l'exploitant (raison sociale, adresse, immatriculation, responsable et contact de confidentialité). | P0 |
| Politique de confidentialité | Le document se présente lui-même comme un modèle générique à valider et sa date de mise à jour est à compléter. Certaines affirmations sont trop générales au regard des intégrations et du fonctionnement technique. | P0 |
| Conditions d'utilisation | Le document est un modèle à valider ; la date est à compléter. | P0 |
| Abonnements, résiliation et remboursements | Le parcours technique réalise un paiement ponctuel, sans renouvellement ni échéance automatique. Le récapitulatif prépaiement l'indique. Les règles contractuelles de durée, résiliation, remboursement, taxes et réclamations restent à compléter et à valider. | P0 |
| Consentement à l'inscription | **Corrigé techniquement dans cette branche** : inscription email et création Google exigent l'acceptation ; date et versions des documents sont stockées côté serveur. Les connexions Google de comptes existants ne sont pas bloquées. | Contrôle technique effectué ; recette requise |
| Cookies et stockage local | La politique ne décrit que le stockage local de session et affirme l'absence de cookies publicitaires. Le code utilise localStorage pour le jeton/profil, un cookie de session HttpOnly, et un service worker/PWA. Un inventaire complet des traceurs et services activés reste nécessaire. | P1 |
| Prestataires et transferts | Google Identity, Wave/PayDunya, email et monitoring sont présents dans le code ou prévus par configuration. Les finalités, catégories de données, lieux de traitement et durées doivent être documentés précisément selon les services effectivement activés. | P1 |
| Droits des personnes et suppression | La politique renvoie à une fonction de réinitialisation pour supprimer des données transactionnelles et au support pour la suppression complète. Il faut vérifier les effets réels, les sauvegardes, les délais et le traitement des demandes. | P1 |
| SEO et transparence du domaine | **Corrigé dans cette branche** : les URL canoniques/Open Graph de démonstration ont été retirées des pages auditées jusqu'à ce que le domaine réel soit confirmé. | Corrigé techniquement |
| Accessibilité des formulaires | **Correction partielle** : labels associés, attributs `autocomplete`, `name` et `minlength=8` ajoutés aux formulaires de connexion/inscription. Les tests clavier et lecteur d'écran restent à exécuter. | P1 — recette requise |
| Sécurité des comptes | Le code vérifié comprend hachage bcrypt, limitation des tentatives, sessions JWT et cookie HttpOnly. Cela ne remplace pas une recette de sécurité complète. | Contrôle partiel |
| Transparence des prix | Les tarifs de référence sont définis côté serveur (Starter 5 000, Pro 15 000, Entreprise 35 000 FCFA par paiement ponctuel). Un récapitulatif affiche formule, montant et prestataire avant redirection ; le mode sans renouvellement ni échéance automatique est annoncé et testé. Taxes, frais du prestataire et politique commerciale restent à préciser. | P0 — validation commerciale requise |
| Avis, témoignages et allégations | Aucune preuve suffisante pour certifier l'ensemble des pages et campagnes ; audit éditorial à terminer. | À vérifier |
| Consentement parental / âge | Aucun mécanisme d'âge ou de consentement parental n'a été identifié dans le formulaire d'inscription. Déterminer l'âge minimal et si le service cible ou accepte des mineurs ; ne pas collecter inutilement de données d'enfants. | À décider |
| Droits sur les images et contenus | La présence d'images dans les pages ne suffit pas à établir les licences. Vérifier les licences et conserver les justificatifs. | À vérifier |
| Contraste et navigation | Le rapport Unslop documente un contraste mesuré de 14,86:1 en thème sombre et une recette responsive. Ces résultats ne certifient pas toutes les exigences WCAG ni les parcours clavier/lecteur d'écran. | Contrôle partiel |

## Grille des 20 contrôles

| N° | Exigence | Résultat |
|---:|---|---|
| 1 | Identité légale de l'éditeur clairement affichée | **À compléter — P0** |
| 2 | Coordonnées de contact et support vérifiables | **Partiel** — support technique présent, coordonnées légales incomplètes |
| 3 | Politique de confidentialité accessible et datée | **À valider — P0** |
| 4 | Données collectées et finalités expliquées | **Partiel** — catégories principales décrites, traitements secondaires incomplets |
| 5 | Durées de conservation et suppression expliquées | **À compléter — P1** |
| 6 | Destinataires, sous-traitants et transferts décrits | **À compléter — P1** |
| 7 | Droits d'accès, rectification, export et suppression opérationnels | **À tester — P1** |
| 8 | Cookies, stockage local et traceurs inventoriés | **À compléter — P1** |
| 9 | Consentement aux traceurs non essentiels, si présents | **À déterminer après inventaire — P1** |
| 10 | Conditions d'utilisation datées et validées | **À valider — P0** |
| 11 | Prix, taxes et périodicité affichés sans ambiguïté | **À vérifier avant achat — P1** |
| 12 | Renouvellement et modification de prix expliqués | **À compléter — P0** |
| 13 | Résiliation et remboursement documentés | **Manquant — P0** |
| 14 | Consentement contractuel à l'inscription enregistré | **Correction technique ajoutée** : case obligatoire, contrôle API et versions datées enregistrées pour l'inscription email et nouvelle création Google. Recette CI à confirmer. |
| 15 | Consentements marketing facultatifs séparés et non précochés | **À vérifier / non identifié** |
| 16 | Aucune publicité trompeuse, faux avis ou frais cachés | **Audit éditorial à terminer** |
| 17 | Images, polices, icônes et contenus utilisés sous licence | **Justificatifs à vérifier** |
| 18 | Labels, clavier, focus, contrastes et lecteurs d'écran | **Partiel** — labels de connexion/inscription corrigés ; recette assistive requise |
| 19 | Âge minimal et protection des mineurs définis | **À décider** |
| 20 | Sécurité des comptes, paiements et parcours d'achat testée | **Partiel** — protections de code présentes ; sandbox et recette de sécurité requises |

## Détails techniques vérifiés

- `public/confidentialite.html` : mention « Modèle à valider avant publication », date à compléter ; décrit les données de compte, d'entreprise et de facturation, mais ne détaille pas suffisamment les traitements de sécurité/monitoring, les durées, les destinataires et les transferts.
- `public/conditions.html` : mention « Modèle à valider avant publication », date à compléter ; la section 6 reporte les règles de facturation, résiliation et remboursement à une publication ultérieure.
- `public/register.html` : labels et autocomplétion corrigés ; case obligatoire d'acceptation des CGU et de prise de connaissance de la politique ajoutée. Le consentement est envoyé à l'API.
- `server/routes/auth.js` : l'inscription refuse l'absence d'acceptation ; les versions des CGU et de la politique et la date d'acceptation sont enregistrées dans les colonnes utilisateurs. Les nouvelles créations via Google suivent la même règle.
- `public/js/api.js` : le jeton et le profil sont conservés dans localStorage ; le serveur pose également un cookie de session HttpOnly. La page de confidentialité a été corrigée pour ne plus prétendre que le stockage local est l'unique mécanisme.
- `public/index.html`, `login.html`, `register.html`, `support.html`, `confidentialite.html`, `conditions.html` : les URL de démonstration `https://votredomaine.com` ont été retirées des balises canoniques/Open Graph auditées. Le domaine public réel devra être configuré ultérieurement.
- `public/abonnement.html` et `server/routes/abonnement.js` : les plans et tarifs sont affichés côté client mais les montants de référence sont définis côté serveur ; les paiements dépendent de la configuration réelle des prestataires.

## Actions obligatoires avant ouverture au public

1. Renseigner l'identité juridique exacte de l'éditeur, son adresse, les identifiants d'entreprise applicables, et un contact officiel pour les demandes de confidentialité.
2. Faire valider et compléter les conditions et la politique de confidentialité pour les juridictions ciblées (notamment Sénégal/CDP si applicable, et RGPD si des personnes dans l'UE sont ciblées).
3. Faire valider et publier les conditions commerciales complètes : durée réelle de l'accès, absence ou présence de renouvellement, taxes et frais éventuels, résiliation, remboursement, rétractation si applicable, incidents de paiement et procédure de réclamation. Le mécanisme actuel est un paiement ponctuel sans échéance automatique.
4. **Consentement technique ajouté** : conserver la case non pré-cochée, vérifier l'acceptation côté serveur et enregistrer date et versions ; tout changement substantiel des documents devra déclencher une nouvelle acceptation des comptes concernés. Ne pas confondre acceptation contractuelle et consentements facultatifs (marketing).
5. Inventorier tous les cookies, stockages, SDK, journaux, outils de mesure et prestataires réellement activés ; ajouter un mécanisme de choix préalable si des traceurs non essentiels sont utilisés.
6. Définir et tester les procédures d'accès, export, rectification et suppression ; préciser les durées de conservation et le sort des sauvegardes.
7. Remplacer les domaines de démonstration par le domaine de production confirmé, ou retirer les balises canoniques/Open Graph jusqu'à cette confirmation.
8. Associer chaque label de formulaire à son champ et compléter la recette clavier, focus visible, erreurs annoncées et lecteur d'écran.
9. Déterminer l'âge minimal et la politique applicable aux mineurs.
10. Vérifier les licences des photos, polices, icônes et autres contenus tiers.
11. Effectuer des transactions sandbox Wave/PayDunya, y compris échec, remboursement si disponible, doublon de webhook et annulation.
12. Faire réaliser une revue juridique et une recette de préproduction sur données fictives/anonymisées avant toute mise en ligne.

## Corrections techniques réalisées dans la branche

- Retrait des URL de démonstration `votredomaine.com` des balises canoniques et Open Graph de l'accueil, connexion, inscription, support, confidentialité et conditions ; aucun domaine réel n'a été inventé.
- Ajout d'une acceptation obligatoire des CGU et d'une prise de connaissance de la politique de confidentialité à l'inscription email et aux nouvelles créations de compte Google. L'API vérifie le booléen et enregistre la date ainsi que les versions acceptées.
- Correction d'une virgule manquante dans les migrations de la base et mise à jour des tests d'intégration pour conserver des créations de comptes de test conformes à l'acceptation obligatoire.
- Transparence du paiement : affichage d'un récapitulatif obligatoire avant redirection, avec montant et prestataire ; contrat de facturation renvoyé par l'API et couvert par un test. Le fonctionnement actuel est ponctuel, sans renouvellement ni expiration automatique. La section abonnements des conditions publiques a été alignée sur ce comportement ; la durée de service et les règles de remboursement restent à définir et faire valider.
- Correction de la description des stockages de session dans la politique de confidentialité ; inventaire complet des traceurs encore requis.
- Correction de la syntaxe JSON-LD de l'organisation sur l'accueil après retrait de l'URL fictive.
- Association explicite des labels aux champs email/mot de passe de connexion et nom/entreprise/email/mot de passe d'inscription ; ajout des attributs `autocomplete`, `name` et `minlength=8` pour le mot de passe.
- Ajout de ce rapport d'audit à la branche.

Ces changements ne résolvent pas les blocages P0 (identité juridique, politique de confidentialité validée, conditions de vente/remboursement et preuve de consentement). Ils doivent être traités avant l'ouverture publique.

## Limites de cet audit

Cet audit est une inspection statique ciblée des fichiers cités. Il ne prouve ni la conformité légale, ni la configuration effective de production, ni l'exhaustivité de tous les parcours, SDK ou traitements. Aucun paiement réel, aucune demande réelle de suppression, aucune analyse juridique et aucun déploiement n'ont été effectués.


## Complément — vérification du parcours de paiement (13 novembre 2026)

L'inspection du serveur a confirmé que Wave et PayDunya sont utilisés pour créer des paiements ponctuels : le serveur enregistre une tentative, contrôle la confirmation du prestataire et le montant reçu, puis associe le plan au compte. Aucune création d'abonnement récurrent, aucun prélèvement automatique futur et aucune date d'expiration du plan ne sont implémentés actuellement.

La page d'abonnement n'annonce donc plus un tarif mensuel : elle présente un montant de paiement unique et impose un récapitulatif avant la redirection. Le client voit la formule, le montant exact en FCFA, le prestataire, le mode ponctuel et l'absence d'échéance automatique. L'API expose ces modalités et le test `server/tests/paiements.test.js` les vérifie.

**Blocage commercial toujours ouvert :** tant que la durée d'accès, les règles de résiliation/remboursement, les taxes/frais et l'identité juridique de l'opérateur ne sont pas définies et validées, ce travail ne constitue pas une autorisation d'ouverture commerciale. Les transactions sandbox et la configuration réelle des prestataires restent à tester.
