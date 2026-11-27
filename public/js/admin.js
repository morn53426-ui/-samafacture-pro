(function(){
'use strict';
const charts=[];
const byId=id=>document.getElementById(id);
const fmtCount=value=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number.isFinite(Number(value))?Number(value):0);
const safe=value=>Number.isFinite(Number(value))?Number(value):0;
const esc=value=>String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const fmtAmount=(value,currency)=>{const code=String(currency||'XOF').toUpperCase();try{return new Intl.NumberFormat('fr-FR',{style:'currency',currency:code,maximumFractionDigits:2}).format(safe(value));}catch(_){return fmtCount(value)+' '+code;}};
const bucketLabel=value=>{if(!value)return'—';const p=String(value).split('-').map(Number);if(p.length===3)return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short'}).format(new Date(Date.UTC(p[0],p[1]-1,p[2],12)));if(p.length===2)return new Intl.DateTimeFormat('fr-FR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(Date.UTC(p[0],p[1]-1,15,12)));return String(value);};
function state(message,error){const el=byId('admin-state');el.hidden=false;el.classList.toggle('is-error',!!error);el.textContent=message;byId('admin-dashboard').hidden=true;}
function notice(message){byId('admin-notice').textContent=message||'';byId('admin-notice').hidden=!message;}
function resetCharts(){while(charts.length){try{charts.pop().destroy();}catch(_){}}}
function initializeDates(){const now=new Date(),to=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10),start=new Date(now);start.setDate(start.getDate()-29);const from=new Date(start.getTime()-start.getTimezoneOffset()*60000).toISOString().slice(0,10);byId('period-from').value=from;byId('period-to').value=to;}
function renderRevenue(data){
 const period=data.period_by_currency||[],all=data.all_time_by_currency||[];
 const currencies=Array.from(new Set(period.concat(all).map(row=>row.currency))).sort();
 byId('revenue-cards').innerHTML=currencies.length?currencies.map(currency=>{const current=period.find(x=>x.currency===currency),lifetime=all.find(x=>x.currency===currency);return '<div class="admin-revenue-card"><span>Encaissé sur la période · '+esc(currency)+'</span><strong>'+esc(fmtAmount(current?current.amount:0,currency))+'</strong><small>'+fmtCount(current?current.confirmed_payments:0)+' paiement(s) confirmé(s) · Total historique : '+esc(fmtAmount(lifetime?lifetime.amount:0,currency))+'</small></div>';}).join(''):'<div class="admin-revenue-card"><span>Aucun paiement d’abonnement confirmé</span><strong>0</strong><small>Les paiements en attente ou échoués sont exclus.</small></div>';
 const trend=data.trend||[];
 byId('revenue-table').innerHTML=trend.length?trend.map(row=>'<tr><td>'+esc(bucketLabel(row.bucket))+'</td><td>'+esc(row.currency)+'</td><td>'+fmtCount(row.confirmed_payments)+'</td><td>'+esc(fmtAmount(row.amount,row.currency))+'</td></tr>').join(''):'<tr><td class="admin-empty-cell" colspan="4">Aucun encaissement confirmé sur cette période.</td></tr>';
 const planRows=data.by_plan_by_currency||[],planLabels={starter:'Standard',standard:'Standard',pro:'Pro',entreprise:'Entreprise',gratuit:'Gratuit'};
 byId('revenue-plan-table').innerHTML=planRows.length?planRows.map(row=>'<tr><td>'+esc(planLabels[row.plan]||row.plan)+'</td><td>'+esc(row.currency)+'</td><td>'+fmtCount(row.confirmed_payments)+'</td><td>'+esc(fmtAmount(row.amount,row.currency))+'</td></tr>').join(''):'<tr><td class="admin-empty-cell" colspan="4">Aucun revenu d’abonnement confirmé sur cette période.</td></tr>';
 byId('recurring-note').textContent=data.recurring_metrics_note||'MRR et ARR non calculés : aucune base fiable disponible.';
}
function renderPlans(data){
 const a=data.accounts_by_plan||[],s=data.active_saas_subscriptions_by_plan||[],labels={gratuit:'Gratuit',starter:'Standard',pro:'Pro',entreprise:'Entreprise'};
 byId('plans-table').innerHTML=['gratuit','starter','pro','entreprise'].map(plan=>{const ac=a.filter(x=>plan==='starter'?(x.plan==='starter'||x.plan==='standard'):x.plan===plan).reduce((total,x)=>total+safe(x.accounts),0),sub=s.find(x=>x.plan===plan);return '<tr><td>'+labels[plan]+'</td><td>'+fmtCount(ac)+'</td><td>'+fmtCount(sub?sub.subscriptions:0)+'</td></tr>';}).join('');
}
function renderPages(rows){const list=rows||[];byId('pages-table').innerHTML=list.length?list.map(row=>'<tr><td>'+esc(row.page_path)+'</td><td>'+fmtCount(row.page_views)+'</td><td>'+fmtCount(row.estimated_sessions)+'</td></tr>').join(''):'<tr><td colspan="3" class="admin-empty-cell">Aucune visite mesurée.</td></tr>';}
async function renderCharts(data){
 resetCharts();try{await window.chartReady;}catch(_){notice('Les chiffres restent disponibles, mais le service de graphiques ne répond pas.');return;}
 if(typeof window.Chart!=='function'){notice('Les tableaux restent accessibles ; les graphiques sont indisponibles.');return;}
 const traffic=data.traffic.trend||[],signups=data.signups.trend||[],css=getComputedStyle(document.documentElement);
 const green=css.getPropertyValue('--emerald').trim()||'#0A7A45',purple=css.getPropertyValue('--navy-700').trim()||'#514D8F',grid=css.getPropertyValue('--line').trim()||'#E6E2D9',ink=css.getPropertyValue('--ink-soft').trim()||'#5B6172';
 charts.push(new Chart(byId('traffic-chart'),{type:'line',data:{labels:traffic.map(x=>bucketLabel(x.bucket)),datasets:[{label:'Pages consultées',data:traffic.map(x=>safe(x.page_views)),borderColor:green,backgroundColor:green,tension:.25,pointRadius:2},{label:'Sessions estimées',data:traffic.map(x=>safe(x.estimated_sessions)),borderColor:purple,backgroundColor:purple,tension:.25,pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'bottom',labels:{color:ink,usePointStyle:true,boxWidth:8}}},scales:{x:{ticks:{color:ink,maxRotation:0,autoSkip:true},grid:{display:false}},y:{beginAtZero:true,ticks:{color:ink,precision:0},grid:{color:grid}}}}}));
 charts.push(new Chart(byId('signup-chart'),{type:'bar',data:{labels:signups.map(x=>bucketLabel(x.bucket)),datasets:[{label:'Nouvelles inscriptions',data:signups.map(x=>safe(x.new_accounts)),backgroundColor:green,borderRadius:5,maxBarThickness:28}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:ink,maxRotation:0,autoSkip:true},grid:{display:false}},y:{beginAtZero:true,ticks:{color:ink,precision:0},grid:{color:grid}}}}}));
 const revenueRows=data.revenue&&Array.isArray(data.revenue.trend)?data.revenue.trend:[];
 const currencies=Array.from(new Set(revenueRows.map(row=>row.currency))).sort();
 const revenueRoot=byId('revenue-charts');
 revenueRoot.innerHTML=currencies.length?currencies.map((currency,index)=>'<article class="admin-revenue-chart-card"><h3>Évolution des revenus · '+esc(currency)+'</h3><div class="admin-revenue-chart-wrap"><canvas id="admin-revenue-chart-'+index+'" role="img" aria-label="Évolution des revenus en '+esc(currency)+'"></canvas></div></article>').join(''):'<p class="admin-footnote">Aucun revenu confirmé à représenter sur cette période.</p>';
 currencies.forEach((currency,index)=>{
   const rows=revenueRows.filter(row=>row.currency===currency);
   const values=new Map();
   rows.forEach(row=>values.set(row.bucket,(values.get(row.bucket)||0)+safe(row.amount)));
   charts.push(new Chart(byId('admin-revenue-chart-'+index),{type:'line',data:{labels:rows.map(row=>bucketLabel(row.bucket)),datasets:[{label:'Encaissé en '+currency,data:rows.map(row=>values.get(row.bucket)||0),borderColor:green,backgroundColor:green,tension:.25,pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:context=>fmtAmount(context.parsed.y,currency)}}},scales:{x:{ticks:{color:ink,maxRotation:0,autoSkip:true},grid:{display:false}},y:{beginAtZero:true,ticks:{color:ink,callback:value=>new Intl.NumberFormat('fr-FR',{notation:'compact'}).format(value)},grid:{color:grid}}}}}));
 });
}
function render(data){
 const s=data.summary||{};
 byId('kpi-pageviews').textContent=fmtCount(s.page_views);byId('kpi-sessions').textContent=fmtCount(s.estimated_sessions);byId('kpi-accounts').textContent=fmtCount(s.registered_accounts);byId('kpi-new-accounts').textContent='Nouvelles inscriptions : '+fmtCount(s.new_accounts);byId('kpi-trials').textContent=fmtCount(s.active_trials);byId('kpi-paid-subscribers').textContent=fmtCount(s.accounts_with_confirmed_subscription_payment);byId('kpi-active-subscriptions').textContent=fmtCount(s.active_saas_subscriptions);
 byId('period-caption').textContent='Période analysée : du '+data.period.from+' au '+data.period.to+' (UTC).';
 renderRevenue(data.revenue||{});renderPlans(data.plans||{});renderPages(data.traffic&&data.traffic.top_pages);
 byId('admin-state').hidden=true;byId('admin-dashboard').hidden=false;renderCharts(data).catch(()=>notice('Impossible de construire les graphiques.'));
}
async function load(){
 state('Chargement des indicateurs sécurisés…',false);notice('');
 const params=new URLSearchParams({from:byId('period-from').value,to:byId('period-to').value});
 try{render(await Api.get('/admin/overview?'+params.toString()));}catch(error){state(error.message||'Impossible de charger le centre administrateur.',true);}
}
byId('period-form').addEventListener('submit',event=>{event.preventDefault();if(byId('period-from').value>byId('period-to').value){state('La date de début doit être antérieure ou égale à la date de fin.',true);return;}load();});
if(!Api.token()){window.location.href='login.html';return;}initializeDates();load();
})();
