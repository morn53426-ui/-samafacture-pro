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
| Abonnements, résiliation et remboursements | Les conditions disent explicitement que facturation, résiliation et remboursement seront précisées séparément. Les tarifs Starter/Pro/Entreprise sont codés côté serveur, mais la politique commerciale complète n'est pas publiée. | P0 |
| Consentement à l'inscription | Le formulaire d'inscription ne présente pas de case d'acceptation des conditions et de la politique de confidentialité. L'API `POST /auth/register` ne reçoit ni ne vérifie de preuve de consentement. | P0 |
| Cookies et stockage local | La politique ne décrit que le stockage local de session et affirme l'absence de cookies publicitaires. Le code utilise localStorage pour le jeton/profil, un cookie de session HttpOnly, et un service worker/PWA. Un inventaire complet des traceurs et services activés reste nécessaire. | P1 |
| Prestataires et transferts | Google Identity, Wave/PayDunya, email et monitoring sont présents dans le code ou prévus par configuration. Les finalités, catégories de données, lieux de traitement et durées doivent être documentés précisément selon les services effectivement activés. | P1 |
| Droits des personnes et suppression | La politique renvoie à une fonction de réinitialisation pour supprimer des données transactionnelles et au support pour la suppression complète. Il faut vérifier les effets réels, les sauvegardes, les délais et le traitement des demandes. | P1 |
| SEO et transparence du domaine | Les pages d'accueil, connexion, inscription, support, confidentialité et conditions contiennent encore des URL canoniques ou Open Graph en `votredomaine.com`. | P1 |
| Accessibilité des formulaires | Plusieurs champs d'authentification ont des labels visuels sans association explicite `for/id`. À corriger et tester avec lecteur d'écran et clavier. | P1 |
| Sécurité des comptes | Le code vérifié comprend hachage bcrypt, limitation des tentatives, sessions JWT et cookie HttpOnly. Cela ne remplace pas une recette de sécurité complète. | Contrôle partiel |
| Transparence des prix | Les prix des abonnements sont définis côté serveur (Starter 5 000, Pro 15 000, Entreprise 35 000 FCFA/mois). Vérifier affichage TTC/HT, taxes éventuelles, renouvellement, date de débit et changement de prix avant achat. | P1 |
| Avis, témoignages et allégations | Aucune preuve suffisante pour certifier l'ensemble des pages et campagnes ; audit éditorial à terminer. | À vérifier |
| Consentement parental / âge | Aucun mécanisme d'âge ou de consentement parental n'a été identifié dans le formulaire d'inscription. Déterminer l'âge minimal et si le service cible ou accepte des mineurs ; ne pas collecter inutilement de données d'enfants. | À décider |
| Droits sur les images et contenus | La présence d'images dans les pages ne suffit pas à établir les licences. Vérifier les licences et conserver les justificatifs. | À vérifier |
| Contraste et navigation | Le rapport Unslop documente un contraste mesuré de 14,86:1 en thème sombre et une recette responsive. Ces résultats ne certifient pas toutes les exigences WCAG ni les parcours clavier/lecteur d'écran. | Contrôle partiel |

## Détails techniques vérifiés

- `public/confidentialite.html` : mention « Modèle à valider avant publication », date à compléter ; décrit les données de compte, d'entreprise et de facturation, mais ne détaille pas suffisamment les traitements de sécurité/monitoring, les durées, les destinataires et les transferts.
- `public/conditions.html` : mention « Modèle à valider avant publication », date à compléter ; la section 6 reporte les règles de facturation, résiliation et remboursement à une publication ultérieure.
- `public/register.html` : champs nom, entreprise, email et mot de passe ; aucun consentement explicite ou lien d'acceptation dans le formulaire.
- `server/routes/auth.js` : la route d'inscription vérifie les champs et la longueur du mot de passe, mais ne reçoit pas de preuve d'acceptation des conditions.
- `public/js/api.js` : le jeton et le profil sont conservés dans localStorage ; le commentaire de code décrit aussi un cookie de session HttpOnly supprimé à la déconnexion.
- `public/index.html`, `login.html`, `register.html`, `support.html`, `confidentialite.html`, `conditions.html` : présence d'URL de démonstration `https://votredomaine.com`.
- `public/abonnement.html` et `server/routes/abonnement.js` : les plans et tarifs sont affichés côté client mais les montants de référence sont définis côté serveur ; les paiements dépendent de la configuration réelle des prestataires.

## Actions obligatoires avant ouverture au public

1. Renseigner l'identité juridique exacte de l'éditeur, son adresse, les identifiants d'entreprise applicables, et un contact officiel pour les demandes de confidentialité.
2. Faire valider et compléter les conditions et la politique de confidentialité pour les juridictions ciblées (notamment Sénégal/CDP si applicable, et RGPD si des personnes dans l'UE sont ciblées).
3. Publier les conditions tarifaires complètes : période, renouvellement, taxes, résiliation, remboursement, rétractation si applicable, incidents de paiement et procédure de réclamation.
4. Ajouter un consentement d'inscription clair, non pré-coché, lié aux versions des documents acceptés et enregistré côté serveur ; distinguer consentement contractuel et consentements facultatifs (marketing).
5. Inventorier tous les cookies, stockages, SDK, journaux, outils de mesure et prestataires réellement activés ; ajouter un mécanisme de choix préalable si des traceurs non essentiels sont utilisés.
6. Définir et tester les procédures d'accès, export, rectification et suppression ; préciser les durées de conservation et le sort des sauvegardes.
7. Remplacer les domaines de démonstration par le domaine de production confirmé, ou retirer les balises canoniques/Open Graph jusqu'à cette confirmation.
8. Associer chaque label de formulaire à son champ et compléter la recette clavier, focus visible, erreurs annoncées et lecteur d'écran.
9. Déterminer l'âge minimal et la politique applicable aux mineurs.
10. Vérifier les licences des photos, polices, icônes et autres contenus tiers.
11. Effectuer des transactions sandbox Wave/PayDunya, y compris échec, remboursement si disponible, doublon de webhook et annulation.
12. Faire réaliser une revue juridique et une recette de préproduction sur données fictives/anonymisées avant toute mise en ligne.

## Limites de cet audit

Cet audit est une inspection statique ciblée des fichiers cités. Il ne prouve ni la conformité légale, ni la configuration effective de production, ni l'exhaustivité de tous les parcours, SDK ou traitements. Aucun paiement réel, aucune demande réelle de suppression, aucune analyse juridique et aucun déploiement n'ont été effectués.
