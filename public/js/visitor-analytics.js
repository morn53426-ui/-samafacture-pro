(function () {
  'use strict';
  const path=window.location.pathname||'/';
  const allowed=new Set(['/','/index.html','/login.html','/register.html','/dashboard.html','/factures.html','/clients.html','/produits.html','/devis.html','/rapports.html','/abonnement.html','/aide.html','/support.html','/professionnel.html','/crm.html','/finances.html','/paiements-professionnels.html','/comptabilite.html','/parametres.html','/achats.html','/automatisations.html','/assistant-ia.html']);
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
