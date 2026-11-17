# Guide de test des paiements — environnement sandbox

Ce guide concerne uniquement les paiements d'abonnement en **mode test**. Il ne configure aucun prélèvement automatique et ne doit pas être utilisé pour mettre le compte en production.

## 1. Préparer les clés PayDunya de test

1. Connectez-vous à votre compte PayDunya Business.
2. Ouvrez la section d'intégration API et créez une application dédiée à SamaFacture Pro.
3. Activez le mode test et récupérez les clés de test de cette application.
4. Vérifiez que les moyens suivants sont activés dans la configuration de l'intégration : carte (`card`), Wave Sénégal (`wave-senegal`) et Orange Money Sénégal (`orange-money-senegal`).

Les identifiants des canaux et le champ `invoice.channels` sont documentés ici :
- https://developers.paydunya.com/doc/FR/http_json
- https://developers.paydunya.com/index.php/doc/FR/introduction
- https://developers.paydunya.com/doc/FR/NodeJS

## 2. Configurer l’environnement local

Dans le fichier local `server/.env` (qui ne doit jamais être commité), renseignez les clés de test :

```dotenv
PAYDUNYA_MASTER_KEY=<votre_cle_maitre_de_test>
PAYDUNYA_PRIVATE_KEY=<votre_cle_privee_de_test>
PAYDUNYA_PUBLIC_KEY=<votre_cle_publique_de_test>
PAYDUNYA_TOKEN=<votre_token_de_test>
PAYDUNYA_MODE=test

# Renseignez les clés Wave Business seulement si vous testez aussi le parcours Wave direct.
WAVE_API_KEY=
WAVE_SIGNING_SECRET=
```

Ne placez jamais ces valeurs dans un commit, une capture d’écran, un ticket public ou un message de chat. Conservez les clés réelles hors du dépôt.

## 3. Lancer SamaFacture Pro localement

Depuis le dossier `server` :

```bash
npm install
npm test
npm start
```

Le test `tests/paydunya-channels.test.js` vérifie sans appel réseau que chaque choix transmet le bon tableau `invoice.channels` :
- Wave Sénégal : `wave-senegal`
- Orange Money Sénégal : `orange-money-senegal`
- Carte bancaire : `card`

## 4. Vérifier le parcours sandbox dans le navigateur

1. Connectez-vous avec un compte de test local.
2. Ouvrez la page Abonnement.
3. Choisissez un plan Starter ou Pro.
4. Lancez séparément un paiement Wave, un paiement Orange Money et un paiement par carte.
5. Sur la page hébergée PayDunya, vérifiez que seul le moyen choisi est proposé (pour les parcours PayDunya).
6. Terminez les transactions avec les comptes fictifs / scénarios sandbox fournis par PayDunya.
7. Vérifiez le retour dans SamaFacture, le statut du paiement et le plan activé.

Pour Wave direct, exécutez aussi le parcours sandbox du compte Wave Business si les clés correspondantes sont configurées.

## 5. Limites et sécurité

- Le mode test doit être utilisé jusqu’à validation complète des callbacks, montants, devises et scénarios d’échec.
- Un canal qui n’est pas activé dans la configuration du compte marchand peut être refusé par le fournisseur ; la simple présence des clés API ne prouve pas son activation.
- Ne testez jamais avec les clés de production ni avec un moyen de paiement réel.
- Les paiements restent actuellement **ponctuels** : aucun mandat, aucune échéance mensuelle automatique et aucun débit futur ne sont créés par cette intégration.
- Le renouvellement automatique sera une fonctionnalité distincte, activée uniquement si le client donne son consentement explicite et si le prestataire confirme la prise en charge des débits récurrents pour le canal choisi.