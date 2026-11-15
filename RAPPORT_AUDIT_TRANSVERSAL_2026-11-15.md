# Audit transversal SamaFacture Pro — 15 novembre 2026

## Périmètre et méthode

Audit effectué sur la tête de branche \`46498ea2fb95e6620c975b757889b593f41d43ce\` (PR #23), qui contient la galerie de 19 modèles, les quatre modèles Entreprise supplémentaires, les correctifs d'impression et le partage WhatsApp.

Inspection statique ciblée des flux suivants : authentification et réinitialisation du mot de passe, email, factures/devis, rendu public, PDF/impression, partage WhatsApp, clients, multi-entreprise/permissions, Socket.IO, tâches planifiées, configuration Docker et CI. Les références de fichiers ci-dessous désignent la version de cette branche.

**Limite importante :** ce rapport n'est pas une certification de sécurité ni une recette complète sur navigateur réel. La suite CI associée à cette tête était encore en cours au moment de l'audit et la recette visuelle responsive n'avait pas commencé. Aucun scénario de paiement réel, de SMTP réel, de téléphone WhatsApp réel ou de déploiement public n'a été exécuté. Le balayage du code mort est ciblé et ne constitue pas une analyse AST exhaustive de chaque module du dépôt.

## Synthèse

| Gravité | Constat | État |
|---|---|---|
| P1 | Les emails non envoyés sont journalisés avec leur contenu, y compris des liens secrets ; l'envoi de facture peut être déclaré réussi alors qu'il n'a pas eu lieu | Confirmé |
| P2 | La consultation publique d'un devis n'affiche pas sa date de validité et ne reproduit pas le modèle choisi | Confirmé |
| P2 | Le partage WhatsApp ignore le champ dédié \`clients.whatsapp\` et présume l'indicatif sénégalais pour tout numéro local de 9 chiffres | Confirmé |
| P2 | Les notifications temps réel d'une entreprise ne sont pas jointes à la salle Socket.IO des membres de son équipe | Confirmé par le chemin d'abonnement/émission |
| P1 / blocage CI | Un test de concurrence des créations de facture a expiré à 300 secondes sur le commit précédent ; les tests de la tête auditée ne sont pas encore terminés | Échec précédent confirmé, tête actuelle en attente |
| P3 | Documentation et commentaires encore réglés sur 15 modèles ; petit paramètre inutilisé | Confirmé |
| P3 | CSP avec \`unsafe-inline\` et jeton Bearer conservé dans \`localStorage\` : dette de durcissement connue | Limite documentée, pas de nouvelle exploitation démontrée |

---

## 1. P1 — Les journaux peuvent exposer des liens secrets et l'application annonce un envoi email réussi à tort

**Fichiers :**
- \`server/config/mailer.js\`, fonction \`sendMail\` (environ lignes 26–35)
- \`server/routes/auth.js\`, route \`POST /mot-de-passe-oublie\` (environ lignes 377–405)
- \`server/routes/factures.js\`, \`envoyerFactureParEmail\` et routes \`/:id/envoyer\` / \`/:id/relancer\` (environ lignes 917–938 et 966–1007)

Lorsque SMTP n'est pas configuré, \`sendMail\` écrit dans la console le destinataire, l'objet et le corps complet du message, puis renvoie \`{ sent: false }\`. Or le corps de réinitialisation du mot de passe contient le jeton secret valide 30 minutes. Les messages de facture/devis contiennent aussi le code qui permet de consulter publiquement le document ; les invitations peuvent contenir un jeton d'accès. Toute personne disposant des journaux serveur peut donc récupérer ces liens tant que SMTP est absent.

En parallèle, \`envoyerFactureParEmail\` ignore le résultat \`sent: false\` et renvoie \`success: true\`. La route de relance a le même comportement. Le frontend affiche alors « Email envoyé » même lorsque rien n'a été transmis. La configuration de production ne rend pas SMTP obligatoire au démarrage, donc ce n'est pas uniquement un cas de développement.

**Impact :** exposition de liens de réinitialisation et de consultation client dans les logs ; fausse confirmation d'envoi ; support et utilisateurs induits en erreur.

**Correction recommandée :**
1. Ne jamais journaliser le corps, les liens, les codes ni les jetons email. En absence de SMTP, journaliser uniquement un statut technique et un identifiant de corrélation.
2. Faire remonter explicitement \`sent: false\` aux routes manuelles facture/relance et renvoyer un statut d'échec contrôlé (par exemple 503) plutôt qu'un succès.
3. Garder la réponse générique anti-énumération de la réinitialisation de mot de passe, mais ne jamais afficher le lien secret dans les logs.
4. Modifier les tests : ils doivent vérifier qu'aucun faux succès n'est renvoyé lorsque l'email n'est pas réellement envoyé, et que les journaux ne contiennent pas le jeton.

## 2. P2 — La consultation publique d'un devis affiche une échéance de facture au lieu de sa validité

**Fichiers :**
- \`server/routes/public.js\`, route \`GET /consulter/:id/:code\` (environ lignes 119–136)
- \`public/consulter.html\` (environ lignes 132–135)

La requête publique ne renvoie pas \`f.date_validite\`. La page publique affiche pourtant toujours le libellé « Échéance » avec \`facture.date_echeance\`, même lorsque \`facture.type === 'devis'\`. Pour un devis normal, la date d'échéance est vide et la vraie date de validité est perdue.

Le partage WhatsApp nouvellement ajouté utilise précisément ce lien public ; l'envoi email existant s'appuie également sur la même page. Le défaut affecte donc les deux canaux.

**Autre divergence visuelle liée au même parcours :** \`public/consulter.html\` reconstruit un document générique distinct du moteur \`createFactureTemplates\`. Le client ne voit pas le même modèle, les mêmes blocs de références ni nécessairement les mêmes mentions que le document de détail/PDF choisi par l'entreprise.

**Correction recommandée :** inclure \`date_validite\` dans le DTO public, afficher « Validité du devis » pour un devis et « Échéance » pour une facture ; faire converger le rendu public et le moteur partagé, ou documenter précisément les informations volontairement différentes.

## 3. P2 — Le partage WhatsApp peut sélectionner le mauvais numéro

**Fichiers :**
- \`server/routes/clients.js\` (création/mise à jour du client, environ lignes 127–184)
- \`server/routes/factures.js\` (liste des documents, environ lignes 339–340)
- \`public/js/whatsapp-share.js\` (normalisation et construction du lien, environ lignes 4–48)

Le modèle client possède deux champs distincts : \`telephone\` et \`whatsapp\`. Le partage WhatsApp n'utilise que \`client_telephone\`, et la requête de liste ne sélectionne que \`c.telephone\`. Le numéro WhatsApp explicite enregistré dans la fiche client est donc ignoré.

De plus, tout numéro de 9 chiffres sans préfixe est automatiquement transformé en numéro +221. Cette règle est propre au Sénégal mais elle n'est pas conditionnée par le pays du client ou de l'entreprise. Pour un numéro local d'un autre pays, le lien peut être envoyé à un destinataire incorrect.

**Correction recommandée :** utiliser prioritairement le champ \`whatsapp\`, puis \`telephone\` comme repli ; ne préfixer +221 que lorsque le pays du client est connu comme Sénégal. Dans les autres cas, demander/obliger un numéro international explicite plutôt que deviner.

## 4. P2 — Les membres d'équipe ne rejoignent pas la salle des notifications de l'entreprise sélectionnée

**Fichiers :**
- \`server/middleware/tenant.js\` (environ lignes 25–54)
- \`server/realtime.js\` (environ lignes 48–76)
- \`public/js/sidebar.js\` (initialisation de Socket.IO, environ lignes 313–345)
- routes qui appellent \`notifierUtilisateur(req.tenantId, ...)\`, notamment clients et factures

Le middleware multi-entreprise transforme correctement le propriétaire choisi en \`req.tenantId\`. Les notifications métier sont ensuite émises vers \`user:<tenantId>\`. Mais la connexion Socket.IO ne vérifie que le JWT du membre et le fait rejoindre \`user:<socket.userId>\` ; le navigateur ne transmet pas la société active à Socket.IO et le serveur ne rejoint aucune salle d'entreprise après validation de l'adhésion.

**Impact :** un membre qui travaille dans l'espace d'une autre entreprise peut effectuer l'action autorisée, mais ne reçoit pas les notifications temps réel émises vers le propriétaire de cette entreprise. Le propriétaire, lui, peut les recevoir.

**Correction recommandée :** authentifier la sélection d'entreprise au niveau Socket.IO avec vérification de l'adhésion active, puis rejoindre la salle de l'entreprise autorisée ; ne jamais accepter un identifiant de société fourni par le client sans vérifier le membership. Ajouter un test avec un propriétaire et un membre.

## 5. P1 — Le test de concurrence des factures a déjà expiré ; la tête actuelle n'est pas encore validée

**Fichier :** \`server/tests/factures.test.js\`, test « créer plusieurs factures en même temps ne produit jamais de numéro en double » (environ lignes 311–330).

Sur les commits `dd7b9712ab8dbfcc747fbebe77a6e9a19bf61dbd` (workflow `43726234432`), `5d7957e6df8ef94174a8c12c1b916e76e131375f` (workflow `43726931658`) et `46498ea2fb95e6620c975b757889b593f41d43ce` (workflow `43727827126`), le test qui lance dix créations simultanées a expiré après 300 secondes. Le test suivant sur les paiements a également expiré, puis le processus Node a été arrêté à 12 minutes (code 124). Dans ces trois exécutions, construction Docker et installation des dépendances avaient pourtant réussi. Le blocage est donc reproductible. Le test de concurrence et le chemin métier de création/numérotation correspondants ne font pas partie des fichiers fonctionnels modifiés par cette PR ; il s'agit d'un problème préexistant du socle, observé pendant cet audit.

La tête auditée `46498ea2fb95e6620c975b757889b593f41d43ce` n'avait pas de résultat final au dernier contrôle ; après ajout du présent rapport, une nouvelle exécution a commencé sur `44543e6200dc71e0f0001ac93db515b339894d99`. Il faut obtenir un résultat final sur la tête exacte et une recette responsive réussie avant fusion. Les timeouts précédents proviennent du test de concurrence existant ; les ajouts de modèles/WhatsApp ne modifient pas directement ce test.

**Correction recommandée :** diagnostiquer le blocage MySQL/pool pendant les dix POST concurrents, vérifier la libération des connexions et les verrous de numérotation, puis relancer toute la suite sur la nouvelle tête. Ne pas augmenter simplement le timeout pour masquer le blocage.

## 6. P3 — Code mort ciblé et documentation en retard

Constats confirmés :
- \`public/js/facture-templates.js\` : le paramètre \`isDevis\` de \`totalsRowsHtml(facture, isDevis, ...)\` n'est pas utilisé dans le corps de cette fonction. C'est un petit résidu à supprimer ou à employer, sans effet métier observé.
- \`public/parametres.html\` : un commentaire de galerie parle encore de quinze rendus.
- \`README.md\` : l'aperçu des fonctionnalités continue d'annoncer 15 modèles alors que la galerie en expose 19.
- \`README.md\` et \`RECETTE_PREPRODUCTION.md\` ne décrivent pas encore clairement le partage manuel WhatsApp ajouté : le texte doit distinguer le lien \`wa.me\` prérempli (confirmation humaine) d'un véritable envoi WhatsApp Business automatique.

Aucun fichier entier nouvellement introduit par la fonctionnalité WhatsApp n'est orphelin : \`public/js/whatsapp-share.js\` est référencé dans les pages Factures, Devis et Détail, et son test dédié l'importe. **En revanche, ce travail n'est pas un balayage exhaustif AST de tous les exports et fonctions des 95 fichiers JavaScript inventoriés dans le dépôt** ; je ne déclare donc pas l'ensemble du code mort « propre » sur cette seule base.

## 7. Dette de sécurité et limites de recette à maintenir visibles

- \`server/app.js\` autorise toujours \`'unsafe-inline'\` pour scripts et styles dans la CSP. Le rapport de sécurité existant explique que le frontend dépend de scripts inline et d'attributs \`onclick\`. C'est une limite connue qui réduit l'efficacité de la CSP contre certaines XSS ; aucun nouvel exploit n'a été démontré par cet audit.
- L'authentification web principale conserve le JWT dans \`localStorage\` et l'envoie en Bearer ; le cookie HttpOnly est une voie de repli, pas encore le mécanisme principal. La surface XSS reste donc importante.
- Le contrôle de conformité du 13 novembre laisse encore l'inventaire des cookies/stockages/SDK et certains contrôles éditoriaux/accessibilité à compléter.
- La galerie et les styles d'impression ont des tests de source ; cela ne prouve pas que les 19 modèles produisent tous des PDF multi-pages impeccables sur Chrome, Safari et mobile. La recette visuelle du commit courant doit finir et les PDF longs doivent être inspectés.

---

## Plan de correction conseillé

1. **Avant toute mise en production :** supprimer l'exposition des contenus email/secrets dans les logs et corriger les faux succès SMTP ; obtenir une suite CI verte sur la tête exacte.
2. **Parcours clients :** corriger le DTO et le rendu public des devis ; prendre en charge le champ WhatsApp et le pays du client.
3. **Multi-entreprise :** corriger les salles Socket.IO et ajouter un test propriétaire/membre.
4. **Qualité :** mettre à jour README/commentaires, supprimer les petits résidus inutilisés, puis exécuter un balayage AST complet des imports/exports/code mort.
5. **Recette finale :** tests MySQL, PDF multi-pages, affichage et impression sur navigateur mobile/desktop, email sandbox, WhatsApp sur numéros de test, droits multi-tenant et paiements sandbox.

## Conclusion

La base contient plusieurs protections utiles (requêtes SQL paramétrées, cloisonnement tenant des routes principales, jetons signés, PDF testés, liens publics par code, verrouillages MySQL sur plusieurs tâches). Toutefois, les défauts P1 ci-dessus, les anomalies de devis/WhatsApp/multi-entreprise et l'absence de résultat CI final sur la tête auditée empêchent de qualifier cette branche de prête pour la production.

**État au moment de l'audit :** PR #23 ouverte, non fusionnée, non déployée ; workflow de tests de la tête auditée en cours.
