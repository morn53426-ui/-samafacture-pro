# Rapport d'audit et d'exécution — Run 32 — 24 novembre 2026

> Rapport **append-only et concis**. Les rapports précédents restent intacts. Référence : `origin/main` = `c32ed40` (CI « Tests Node.js et MySQL » : succès). Schéma v23.

## 1. Périmètre traité
| Phase | Statut |
|---|---|
| A — dépôt, `main`, PR, CI | Fait |
| B — revue sécurité PR #218 | Fait |
| C — essai gratuit et abonnements | Fait en partie (inscription, changement de formule, unicité) |
| D — comptabilité OHADA | **Non traitée** |
| E — non-régression factures/devis/PDF | **Non traitée** |
| F — défauts UX | **Non traitée** |

## 2. Découvertes

| # | Constat | Statut | Lot |
|---|---|---|---|
| 1 | PR #218 : les 25 tables contrôlées existent, ont `user_id` et un index de tête ; les cascades des 4 `DELETE` ne touchent hors liste que `facture_lignes`. Aucune anomalie bloquante. | Validé | — |
| 2 | Un seul historique sur 25 était testé, sans chemin de succès ni test de concurrence. | Corrigé et testé | PR #219 |
| 3 | `POST /auth/register` : 4 inscriptions simultanées du même email → `201, 500, 500, 500` au lieu de `201, 409, 409, 409`. Un seul compte et un seul essai sont créés (index `uk_users_email`). | Corrigé et testé | PR #220 |
| 4 | Le gestionnaire d'erreurs journalise la requête SQL avec ses valeurs : hash bcrypt, email, jetons. Mesuré : 15 hash sur 15 erreurs. | Corrigé et testé | PR #221 |
| 5 | `POST /auth/google` : même structure `SELECT` puis `INSERT` que le point 3. Constaté à la lecture, non reproduit (jeton Google requis). | Anomalie probable, non traitée | — |

## 3. Essai gratuit — conclusions
- L'essai est rattaché à la ligne `users`. Il n'existe pas d'identifiant d'entreprise : l'unicité repose sur l'email. Je n'en ai pas inventé.
- Seuls 4 `INSERT INTO users` existent (inscription email et Google) ; aucun parcours équipe ou groupe ne crée d'essai.
- Aucune route ne supprime la ligne `users` : la réinitialisation ne supprime que les données, donc l'historique d'essai est conservé.
- `PUT /auth/plan` : hors essai actif, tout plan payant renvoie 403 `PAIEMENT_REQUIS`.
- **Limite non corrigible sans décision produit** : les alias d'email (`a+1@…`, points Gmail) permettent plusieurs essais pour une même personne.

## 4. Risques restants
- Alias d'email et essais multiples (voir §3).
- Point 5 (Google).
- Sentry : le message d'erreur peut contenir un email ; non vérifié sur une instance réelle. Journaux déjà écrits non purgés.
- Les factures en brouillon bloquent aussi le reset de compte (choix de la #218 à valider).

## 5. Contrôles impossibles dans cet environnement
- MySQL 8 : tests exécutés sous MariaDB ; 6 échecs propres à l'environnement (défauts de colonne, police IBM Plex hors ligne), identiques sur `main`. La CI fait foi.
- Paiements réels, Sentry, appareils réels : non testés.

## 6. Prochaine priorité
Phase D (comptabilité OHADA et contrepassations), puis E (PDF réels) ; le point 5 en lot indépendant.
