# Facturation mensuelle et renouvellement automatique — décision produit

**Décision produit enregistrée : 16 novembre 2026**

SamaFacture Pro doit proposer ses formules payantes sur une période **mensuelle**, avec **renouvellement automatique**. Cette règle concerne le modèle commercial cible des plans Starter, Pro et Entreprise. Le prélèvement effectif ne doit toutefois être activé que lorsqu'un prestataire autorise techniquement et contractuellement un paiement récurrent avec le consentement approprié du client.

## Ce qui est décidé

- Périodicité cible : mensuelle.
- Renouvellement cible : automatique à chaque échéance tant que le client n'a pas résilié.
- Résiliation : doit pouvoir être effectuée depuis le compte du client, avec une date d'effet et une confirmation visibles.
- Activation et prolongation d'accès : uniquement après confirmation serveur d'un règlement valide ou d'un événement de renouvellement signé et vérifié.
- Aucun stockage de numéro de carte, CVV, code OTP ou identifiant secret de portefeuille dans SamaFacture Pro.
- Les montants actuels du backend (Starter 5 000 XOF, Pro 15 000 XOF, Entreprise 35 000 XOF) sont actuellement paramétrés comme des **paiements uniques**. Ils ne deviennent pas automatiquement des prix mensuels par cette décision ; les tarifs mensuels doivent être approuvés avant publication commerciale.

## Vérification des prestataires — 16 novembre 2026

### Wave Business

La documentation API officielle consultée liste le Checkout, le solde/rapprochement, les paiements sortants, les marchands agrégés et les webhooks. Le Checkout documente notamment la création, la consultation, l'expiration et le remboursement de sessions de paiement. Les endpoints publics consultés ne décrivent pas la création d'un mandat de prélèvement client ni un objet d'abonnement récurrent.

Sources :
- https://docs.wave.com/business
- https://docs.wave.com/checkout

**Conclusion opérationnelle :** l'intégration Checkout actuellement présente dans le dépôt ne suffit pas à débiter automatiquement un client chaque mois. Obtenir une confirmation écrite de Wave sur l'existence d'un produit/contrat de mandat récurrent disponible pour le compte marchand SamaFacture Pro avant tout développement de prélèvement.

### PayDunya

La documentation WebPay/PAR consultée décrit la création d'une facture de paiement et d'un token pour suivre le statut de la transaction (pending, cancelled, completed). La documentation publique de PayDunya présente aussi le produit Collect pour organiser des collectes récurrentes avec automatisation des demandes de paiement. Cette présentation ne démontre pas, à elle seule, qu'une API autorise le débit automatique du même moyen de paiement sans nouvelle action du client à chaque échéance.

Sources :
- https://developers.paydunya.com/doc/FR/http_json
- https://paydunya.com/collect
- https://developers.paydunya.com/doc/FR/definitions

**Conclusion opérationnelle :** demander à PayDunya si Collect fournit, pour un abonnement SaaS, un mandat réutilisable ou un mécanisme de débit périodique autorisé, ou s'il automatise uniquement l'envoi d'une nouvelle demande que le client doit payer. Demander également les conditions d'annulation, de révocation, de retry, de notification, de remboursement et de disponibilité pays par pays.

### Flutterwave — candidat à valider pour les cartes

La documentation officielle Flutterwave décrit des plans de paiement mensuels qui déclenchent les débits suivants après la première transaction. Le prestataire gère les cycles suivants, envoie des rappels, effectue trois nouvelles tentatives après un échec (à 30 minutes d'intervalle), puis annule l'abonnement après trois échecs consécutifs. Des webhooks sont prévus pour les débits réussis/échoués et l'annulation.

**Limite importante :** l'intégration d'un plan de paiement récurrent est réservée aux cartes. Elle ne permet pas de présenter Wave, Orange Money ou Free Money comme des moyens de prélèvement mensuel automatique. Ces moyens peuvent rester des options de paiement ponctuel si une politique distincte le prévoit.

Flutterwave indique être licencié pour accompagner les entreprises sénégalaises et présente l'acceptation des cartes Visa/Mastercard et du mobile money local. Cela ne garantit toutefois pas à lui seul l'activation d'un compte marchand précis, ni la disponibilité d'un plan récurrent en XOF pour ce compte.

**Conclusion opérationnelle :** Flutterwave devient le premier candidat à tester pour les abonnements mensuels par carte, sous réserve de :
- validation écrite de l'accès aux Payment Plans pour le compte marchand SamaFacture Pro domicilié au Sénégal ;
- confirmation de l'acceptation des plans et débits récurrents en XOF ;
- validation sandbox de la souscription initiale, des renouvellements, des webhooks, de l'annulation et des échecs ;
- confirmation des modalités de règlement marchand, frais, chargebacks et gestion des cartes expirées.

Aucun bouton ni prélèvement Flutterwave ne doit être activé avant cette validation. Aucun client ne doit être basculé d'un paiement Wave/Orange Money ponctuel vers une facturation par carte sans consentement explicite.

Sources officielles :
- https://developer.flutterwave.com/docs/recurring-payments/payment-plans
- https://developer.flutterwave.com/docs/payment-methods
- https://flutterwave.com/eu/blog/bonjour-senegal-flutterwave-is-now-licensed-to-power-payments-for-senegalese-businesses

## Distinction à préserver

Trois mécanismes ne doivent pas être confondus :

1. **Rappel automatisé :** le système envoie chaque mois une notification ou un lien de paiement ; le client doit encore payer.
2. **Renouvellement d'accès après paiement :** l'application prolonge l'abonnement après confirmation du paiement ; le paiement peut avoir été initié par le client.
3. **Prélèvement automatique récurrent :** un mandat/consentement valide permet au prestataire de déclencher le paiement périodique selon ses règles, sans nouvelle saisie du client.

La décision produit demande le troisième mécanisme. Le premier et le deuxième ne doivent pas être commercialisés comme un débit automatique.

## Modèle technique requis avant activation

Prévoir les entités suivantes dans le moteur d'abonnement :

- Abonnement : compte payeur, plan, période mensuelle, statut, date de début, fin de période, prochaine échéance, état du renouvellement et référence de mandat fournie par le prestataire si disponible.
- Échéance/facture d'abonnement : période concernée, prix figé, devise, référence idempotente, prestataire, statut, date de paiement et référence externe.
- Événement d'abonnement : création, paiement, renouvellement, échec, période de grâce, résiliation, réactivation et intervention opérateur.

États minimums à gérer : `pending_authorization`, `active`, `past_due`, `grace_period`, `cancel_at_period_end`, `cancelled`, `suspended`, `expired`.

Contrôles obligatoires :

- Consentement explicite avant le premier renouvellement, avec preuve horodatée, prix, périodicité et modalités de résiliation.
- Vérification de signature des webhooks et contrôle du statut directement auprès du prestataire.
- Idempotence par référence de transaction et par échéance ; deux workers ne doivent jamais renouveler deux fois la même période.
- Historique non destructif des échéances et événements.
- Notifications avant renouvellement, à la confirmation et en cas d'échec.
- Politique documentée de retry, de grâce, de suspension et de réactivation.
- Résiliation en libre-service, export des données et information sur la fin d'accès.
- Tests sandbox pour succès, échec, webhook dupliqué, webhook inversé, retard, révocation du mandat, remboursement et indisponibilité du prestataire.

## Critères de sortie

Le renouvellement automatique reste **non activé** jusqu'à ce que les éléments suivants soient tous réunis :

- réponse écrite du prestataire confirmant la capacité et les conditions de débit récurrent ;
- prix mensuels approuvés pour chaque formule ;
- parcours de consentement et de résiliation validé ;
- moteur d'abonnement et de rapprochement implémenté ;
- tests sandbox complets et recette sur un compte marchand autorisé ;
- documents contractuels et mentions légales mis à jour pour les pays activés.

**État du dépôt :** le checkout existant est un paiement ponctuel ; aucun prélèvement mensuel automatique n'est actuellement effectué. Ne pas masquer cette limite dans l'interface ou les messages commerciaux.
