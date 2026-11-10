# Modules professionnels — SamaFacture Pro

Ce document décrit le périmètre présent dans le code de la branche `main` après la fusion des modules professionnels. La réussite des tests GitHub ne signifie pas à elle seule que la version est déployée ou validée en préproduction.

## 1. Ventes
- Commandes clients enregistrées avec lignes, total et statut.
- Création d'un bon de livraison à partir d'une commande.
- Avoirs rattachés à une facture d'origine, avec validation/rejet.
- Demandes d'acompte rattachées à une facture finale ; l'encaissement est enregistré dans les paiements de cette facture.

Les bons de livraison et les avoirs sont des enregistrements dédiés dans cette première version. Le moteur complet de conversion commande → facture et les modèles PDF spécifiques à ces documents restent à approfondir.

## 2. Clients
- Relevé de compte : factures, paiements et solde calculé.
- Relance par email si le SMTP est configuré.
- Préparation d'un message WhatsApp avec lien wa.me ; l'utilisateur doit confirmer l'envoi dans WhatsApp.

## 3. Paiements
- Liens de demande de paiement partageables avec QR code et page publique.
- Liste des transactions déjà enregistrées.
- Création, approbation/rejet et suivi des demandes de remboursement.

Un lien et son QR code ne sont pas un encaissement. Il n'y a pas de débit Wave/Orange Money/PayDunya connecté par ce nouveau module. Le remboursement effectif doit être exécuté dans l'interface du prestataire ou auprès de la banque, puis sa référence doit être enregistrée dans SamaFacture Pro.

## 4. Équipe
- Invitations par email ou lien sécurisé, valables sept jours.
- Rôles prédéfinis et rôles personnalisés avec permissions.
- Désactivation d'un membre.
- Possibilité pour un compte membre d'ouvrir les espaces des entreprises auxquelles il appartient.

L'isolation du compte est appliquée par middleware aux routes principales (clients, produits, factures, tableau de bord, dépenses, rapports et factures récurrentes) ainsi qu'aux nouveaux modules. Les autres services de compte (par exemple l'abonnement) restent liés au compte de connexion.

## 5. Gestion
- Enregistrement d'établissements.
- Création de caisses.
- Mouvements d'entrée/sortie avec contrôle du solde et transaction verrouillée.

Les caisses sont un suivi interne des mouvements. Elles ne se synchronisent pas automatiquement avec les tiroirs-caisses physiques, les banques ou les prestataires de paiement.

## 6. Documents
- Archivage de fichiers PDF, JPEG et PNG (5 Mo maximum).
- Association à un client ou une facture.
- Téléchargement protégé par authentification et isolation du compte.
- Enregistrement d'une image de signature avec empreinte SHA-256 et horodatage.

La signature ajoutée ici est une signature interne simple. Elle n'est pas une signature électronique qualifiée ou certifiée. L'analyse antivirus des pièces jointes n'est pas intégrée dans cette version.

## 7. Rapports
- Calcul d'une marge estimée à partir du prix d'achat renseigné dans le catalogue.
- Prévision simple des encaissements à partir des paiements effectivement datés sur les six derniers mois.
- Rapport filtrable par mois, jour ou client.

Les coûts indirects, impôts, frais et saisonnalités ne sont pas inclus dans les marges ou prévisions simples.

## 8. Automatisation
- Les factures récurrentes existantes continuent d'être générées par le planificateur.
- Nouvelles relances email automatiques sur factures en retard, avec cadence configurable.
- File de livraison des webhooks avec reprises en cas d'échec.

L'envoi WhatsApp automatique n'est pas activé : il nécessite une intégration et des identifiants WhatsApp Business. Le système fournit uniquement une préparation manuelle du message.

## 9. Intégration
- API publique v1 authentifiée par clés à permissions limitées.
- Webhooks signés HMAC-SHA256, secrets chiffrés au repos, retries et contrôle des adresses privées.
- Documentation des endpoints dans `API_PUBLIQUE.md`.

## Mise à niveau de la base de données

La version de schéma proposée par la PR #3 est portée à 7. La migration ajoute notamment `users.token_version` et `facture_usage_mensuelle` ; les tables professionnelles existantes restent en place. Le compteur mensuel des factures gratuites est conservé même après suppression d'une facture et s'applique aux créations, duplications, conversions de devis et factures récurrentes. Avant le déploiement, effectuez une sauvegarde MySQL vérifiée et testez la migration v5 → v7 sur une copie de staging.

## Configuration à prévoir

1. Renseigner `APP_URL` avec le domaine public en HTTPS.
2. Définir et conserver `DATA_ENCRYPTION_KEY` (voir `.env.example` et `server/.env.example`).
3. Configurer `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` et `SMTP_FROM` pour les invitations et relances email.
4. Utiliser un certificat TLS valide et limiter les destinations webhook aux URLs HTTPS publiques.
5. Tester la migration et les scénarios multi-comptes sur une base de staging avant mise en production.

## Vérifications réalisées pendant cette modification

- Compilation syntaxique des modules JavaScript serveur modifiés.
- Compilation des scripts inline des pages professionnelles, catalogue, invitation, paiement, connexion et inscription.
- Équilibre des accolades CSS.
- Vérification statique des routes ajoutées et du schéma des 18 tables professionnelles.

Les tests d'intégration avec MySQL, les tests de sécurité inter-tenant, les tests SMTP/webhooks, ainsi qu'une inspection visuelle réelle sur navigateur/mobile restent à exécuter. Il ne faut pas commercialiser les paiements en ligne, les remboursements automatiques, WhatsApp automatique ou la signature qualifiée comme étant déjà intégrés.
