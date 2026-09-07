SamaFacture Pro — Correctif du 31/08/2026

Corrections appliquées après analyse des logs de tests fournis :

1. PDF / Puppeteer
   - Cause : la page facture-detail.html était ouverte sur le serveur HTTP de test
     (port aléatoire), mais public/js/api.js redirige les appels localhost non-4000 vers
     http://localhost:4000/api. Puppeteer appelait donc une API qui n'était pas celle du
     serveur de test, puis expirait.
   - Correction : utils/pdf.js injecte window.SAMAFACTURE_API_URL vers le même baseUrl
     que la page avant tout script applicatif.
   - Effet attendu : les deux tests PDF (facture et devis) ne doivent plus retourner 502
     pour cette cause.

2. Idempotence des paiements
   - Cause : le contrôle Idempotency-Key initial était effectué avant le verrouillage de
     la facture. Deux requêtes concurrentes pouvaient donc franchir simultanément ce
     contrôle.
   - Correction : second contrôle d'idempotence dans la transaction, après SELECT ... FOR
     UPDATE sur la facture. La seconde requête rejoue alors le paiement déjà créé et
     renvoie 200 au lieu d'une erreur de concurrence.
   - La contrainte UNIQUE en base reste conservée comme garde-fou final.

3. Dashboard / charge
   - Cause observée : Queue limit reached dans buildDashboard, avec 503 dès 250 utilisateurs
     et davantage de 503/ECONNREFUSED sous 500–1000 utilisateurs.
   - Correction : pour les comptes sans facture (cas des comptes créés par le test de charge),
     la récupération des derniers clients passe d'un second aller-retour MySQL à une seule
     requête. Le calcul des agrégations de factures reste évité.
   - La file du pool MySQL par défaut est relevée de 200 à 2000 afin d'absorber les bursts sans
     supprimer la borne du pool de connexions. DB_QUEUE_LIMIT reste configurable par variable
     d'environnement.

Vérifications effectuées dans l'environnement de travail :
- node --check sur tous les fichiers JavaScript du projet : PASS.
- tests/dashboard-regression.test.js : 7/7 PASS.

Limite de vérification :
- Le ZIP ne contient pas node_modules et l'environnement d'exécution courant ne fournit pas
  une instance MySQL/WAMP de la configuration du projet. Le test complet `npm test` ne peut donc
  pas être certifié ici comme 165/165 sans reproduire cette infrastructure.
- Le résultat fourni dans message1.txt indiquait auparavant 162/165 PASS et 3 FAIL :
  2 tests PDF et 1 test d'idempotence des paiements.
- Le test de charge fourni indiquait auparavant des échecs dashboard à 250/500/1000 et un échec
  health à 1000 avec 2 ETIMEDOUT.
