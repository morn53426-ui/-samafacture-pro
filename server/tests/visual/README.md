# Recette visuelle SamaFacture Pro

Cette recette lance un vrai navigateur Chromium via Puppeteer sur les pages réelles de
l'interface. Les appels API sont remplacés par des réponses de démonstration injectées
par le navigateur : aucune base MySQL, aucun compte client et aucune donnée réelle ne
sont utilisés. Le serveur HTTP statique et les fixtures n'existent que pendant le test.

## Lancer les contrôles

Depuis le dossier `server/` :

```bash
npm ci
npm run test:visual
```

Par défaut, le jeu de données `worst` teste des noms et références proches des limites
de saisie, des coordonnées de contact très longues, des champs facultatifs absents, des
montants proches de la limite DECIMAL(14,2), des stocks élevés, des factures en retard,
et des lignes de données vides.

Les autres jeux peuvent être demandés pour comparer les états :

```bash
VISUAL_DATASET=normal npm run test:visual
VISUAL_DATASET=empty npm run test:visual
```

PowerShell :

```powershell
$env:VISUAL_DATASET = "worst"
npm run test:visual
```

## Pages et tailles couvertes

| Page réelle | 320 × 812 | 390 × 844 | 768 × 1024 | 1440 × 1000 |
|---|---:|---:|---:|---:|
| Tableau de bord | ✓ | ✓ | ✓ | ✓ |
| Clients | ✓ | ✓ | ✓ | ✓ |
| Produits | ✓ | ✓ | ✓ | ✓ |
| Factures | ✓ | ✓ | ✓ | ✓ |

Le test vérifie le chargement des données, les erreurs JavaScript, l'absence de débordement
horizontal du document, et la présence des principales lignes de contenu. Il vérifie
également que le graphique métier est configuré sans animation, que le bouton a un retour
press `scale(0.97)`, et qu'une notification respecte `prefers-reduced-motion`.

Le navigateur remplace Chart.js par un petit traceur de test local uniquement pour
stabiliser la capture visuelle ; le test vérifie le paramétrage transmis par la page
(`animation: false`). Le rendu réel de Chart.js reste couvert par les essais de navigateur
connecté décrits ci-dessous.

## Captures et revue humaine

Les captures PNG et le rapport JSON sont écrits dans `server/tests/visual/artifacts/`.
Le workflow GitHub Actions publie ce dossier comme artefact de la CI.

Avant validation finale, ouvrir les captures et refaire manuellement :
- zoom navigateur à 200 % sur les pages Clients, Produits et Factures ;
- navigation clavier (Tab, Entrée, Échap) et focus des info-bulles ;
- thème sombre ;
- Safari iOS et Chrome Android sur appareil réel, notamment clavier ouvert et zones
  sécurisées/notch ;
- connexion réseau réelle pour vérifier que le CDN Chart.js produit le graphique final.

Cette suite n'est pas un diff pixel-à-pixel contre des captures de référence : elle
produit des captures reproductibles et échoue sur les débordements et erreurs constatées.
Les captures doivent être revues par une personne avant de considérer la recette visuelle
comme acceptée.
