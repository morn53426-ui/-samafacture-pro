(function () {
  'use strict';
  const path=window.location.pathname||'/';
  const allowed=new Set([
  '/', '/index.html', '/login.html', '/register.html', '/dashboard.html', '/abonnement.html', '/abonnement-retour.html', '/achats.html', '/aide.html', '/assistant-ia.html', '/automatisations.html', '/clients.html', '/comptabilite.html', '/conditions.html', '/confidentialite.html', '/consulter.html', '/crm.html', '/depenses.html', '/devis.html', '/facture-detail.html', '/facture-ia.html', '/factures-recurrentes.html', '/factures.html', '/finances.html', '/groupe-entreprise.html', '/internationalisation.html', '/invitation.html', '/login.html', '/mot-de-passe-oublie.html', '/nouvelle-facture.html', '/paiement-retour.html', '/paiement.html', '/paiements-professionnels.html', '/parametres.html', '/portail-client.html', '/produits.html', '/professionnel.html', '/rapports.html', '/reinitialiser-mot-de-passe.html', '/support.html', '/verifier.html'
]);
  if(!allowed.has(path)||path==='/admin.html')return;
  if(!window.crypto||typeof window.crypto.getRandomValues!=='function')return;
  let id;
  try{
    id=sessionStorage.getItem('sunupilot_analytics_session_v1');
    if(!id){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);id=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');sessionStorage.setItem('sunupilot_analytics_session_v1',id);}
  }catch(_){return;}
  const host=location.hostname,port=location.port,local=host==='localhost'||host==='127.0.0.1';
  const api=window.SAMAFACTURE_API_URL||(local&&port&&port!=='4000'?'http://'+host+':4000/api':'/api');
  fetch(api+'/analytics/pageview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:id,page_path:path}),keepalive:true,credentials:'same-origin'}).catch(function(){});
})();
