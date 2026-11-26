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
 byId('revenue-cards').innerHTML=period.length?period.map(row=>{const old=all.find(x=>x.currency===row.currency);return '<div class="admin-revenue-card"><span>Encaissé sur la période · '+esc(row.currency)+'</span><strong>'+esc(fmtAmount(row.amount,row.currency))+'</strong><small>'+fmtCount(row.confirmed_payments)+' paiement(s) confirmé(s) · Total historique : '+esc(fmtAmount(old?old.amount:0,row.currency))+'</small></div>';}).join(''):'<div class="admin-revenue-card"><span>Aucun paiement d’abonnement confirmé</span><strong>0</strong><small>Les paiements en attente ou échoués sont exclus.</small></div>';
 const trend=data.trend||[];
 byId('revenue-table').innerHTML=trend.length?trend.map(row=>'<tr><td>'+esc(bucketLabel(row.bucket))+'</td><td>'+esc(row.currency)+'</td><td>'+fmtCount(row.confirmed_payments)+'</td><td>'+esc(fmtAmount(row.amount,row.currency))+'</td></tr>').join(''):'<tr><td class="admin-empty-cell" colspan="4">Aucun encaissement confirmé sur cette période.</td></tr>';
 byId('recurring-note').textContent=data.recurring_metrics_note||'MRR et ARR non calculés : aucune base fiable disponible.';
}
function renderPlans(data){
 const a=data.accounts_by_plan||[],s=data.active_saas_subscriptions_by_plan||[],labels={gratuit:'Gratuit',starter:'Standard',pro:'Pro',entreprise:'Entreprise'};
 byId('plans-table').innerHTML=['gratuit','starter','pro','entreprise'].map(plan=>{const ac=a.find(x=>x.plan===plan),sub=s.find(x=>x.plan===plan);return '<tr><td>'+labels[plan]+'</td><td>'+fmtCount(ac?ac.accounts:0)+'</td><td>'+fmtCount(sub?sub.subscriptions:0)+'</td></tr>';}).join('');
}
function renderPages(rows){const list=rows||[];byId('pages-table').innerHTML=list.length?list.map(row=>'<tr><td>'+esc(row.page_path)+'</td><td>'+fmtCount(row.page_views)+'</td><td>'+fmtCount(row.estimated_sessions)+'</td></tr>').join(''):'<tr><td colspan="3" class="admin-empty-cell">Aucune visite mesurée.</td></tr>';}
async function renderCharts(data){
 resetCharts();try{await window.chartReady;}catch(_){notice('Les chiffres restent disponibles, mais le service de graphiques ne répond pas.');return;}
 if(typeof window.Chart!=='function'){notice('Les tableaux restent accessibles ; les graphiques sont indisponibles.');return;}
 const traffic=data.traffic.trend||[],signups=data.signups.trend||[],css=getComputedStyle(document.documentElement);
 const green=css.getPropertyValue('--emerald').trim()||'#0A7A45',purple=css.getPropertyValue('--navy-700').trim()||'#514D8F',grid=css.getPropertyValue('--line').trim()||'#E6E2D9',ink=css.getPropertyValue('--ink-soft').trim()||'#5B6172';
 charts.push(new Chart(byId('traffic-chart'),{type:'line',data:{labels:traffic.map(x=>bucketLabel(x.bucket)),datasets:[{label:'Pages consultées',data:traffic.map(x=>safe(x.page_views)),borderColor:green,backgroundColor:green,tension:.25,pointRadius:2},{label:'Sessions estimées',data:traffic.map(x=>safe(x.estimated_sessions)),borderColor:purple,backgroundColor:purple,tension:.25,pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'bottom',labels:{color:ink,usePointStyle:true,boxWidth:8}}},scales:{x:{ticks:{color:ink,maxRotation:0,autoSkip:true},grid:{display:false}},y:{beginAtZero:true,ticks:{color:ink,precision:0},grid:{color:grid}}}}}));
 charts.push(new Chart(byId('signup-chart'),{type:'bar',data:{labels:signups.map(x=>bucketLabel(x.bucket)),datasets:[{label:'Nouvelles inscriptions',data:signups.map(x=>safe(x.new_accounts)),backgroundColor:green,borderRadius:5,maxBarThickness:28}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:ink,maxRotation:0,autoSkip:true},grid:{display:false}},y:{beginAtZero:true,ticks:{color:ink,precision:0},grid:{color:grid}}}}}));
}
function render(data){
 const s=data.summary||{};
 byId('kpi-pageviews').textContent=fmtCount(s.page_views);byId('kpi-sessions').textContent=fmtCount(s.estimated_sessions);byId('kpi-accounts').textContent=fmtCount(s.registered_accounts);byId('kpi-new-accounts').textContent='Nouvelles inscriptions : '+fmtCount(s.new_accounts);byId('kpi-trials').textContent=fmtCount(s.active_trials);byId('kpi-paid-plans').textContent=fmtCount(s.accounts_with_paid_plan);byId('kpi-active-subscriptions').textContent=fmtCount(s.active_saas_subscriptions);
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
