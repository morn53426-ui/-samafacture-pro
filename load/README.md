# Tests de charge SamaFacture Pro

Ces scénarios mesurent le vrai comportement HTTP/API sans transformer un résultat `503` ou `429` en faux succès.

## 1. Parcours métier progressif

`k6-10000.js` : montée progressive jusqu'à 10 000 VU. Par défaut, le scénario est en lecture pour éviter de polluer les données.

Pour utiliser plusieurs utilisateurs réels de staging :

```bash
export BASE_URL=https://staging.example.com
export LOAD_TEST_TOKENS_FILE=./load/tokens.json
k6 run load/k6-10000.js
```

`tokens.json` doit être un tableau JSON de JWT temporaires dédiés au staging :

```json
["jwt-utilisateur-1", "jwt-utilisateur-2"]
```

Un seul token peut être utilisé pour un test de capacité HTTP, mais cela ne constitue pas un test multi-utilisateurs représentatif.

## 2. Spike test

```bash
LOAD_TEST_TOKEN='...' k6 run load/k6-spike.js
```

Teste un pic brutal 50 → 500 → 1 000 → 5 000 VU puis la récupération.

## 3. Soak test

```bash
SOAK_VUS=1000 SOAK_DURATION=15m LOAD_TEST_TOKEN='...' k6 run load/k6-soak.js
```

Surveillez les fuites mémoire, les files DB/Redis et la dérive de latence.

## 4. Sécurité sous charge

```bash
SECURITY_RPS=50 k6 run load/k6-security.js
```

Les réponses 401/429 sont attendues ; les 5xx ne le sont pas.

## Critères

Un palier métier est PASS si :

- aucun timeout ;
- aucun 5xx ;
- aucun 4xx inattendu ;
- p95 < 500 ms ;
- p99 < 1 000 ms.

Pour les tests de spike/soak, les seuils sont volontairement plus souples : p95 < 1 s et p99 < 2 s.

Ces seuils sont des critères d'exploitation, pas une certification universelle : la capacité dépend du CPU/RAM, MySQL, Redis, réseau et du nombre d'instances.
