#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const endpoint = process.env.LOAD_ENDPOINT || '/api/dashboard';

// Garde-fou 2026-08-31 : sous Git Bash / MINGW64 (Windows) sans MSYS_NO_PATHCONV=1, la valeur
// de LOAD_ENDPOINT (ex: "/api/health") peut être réécrite en chemin Windows par MSYS avant
// d'atteindre Node (ex: "C:/Program Files/Git/api/health"), ce qui produit une URL invalide et
// fait échouer 100% des requêtes avec ERR_INVALID_URL — une erreur cryptique répétée des
// milliers de fois plutôt qu'un message clair. On valide donc l'URL une seule fois, tôt, avec
// un message explicite plutôt que de laisser fetch() échouer sur chaque requête individuelle.
try {
  // eslint-disable-next-line no-new
  new URL(`${API_URL}${endpoint}`);
} catch {
  throw new Error(
    `LOAD_ENDPOINT/API_URL invalides une fois combinés : "${API_URL}${endpoint}". ` +
    'Si vous êtes sous Git Bash / MINGW64 (Windows), MSYS a probablement réécrit ' +
    '"/api/health" (ou un autre chemin) en chemin Windows avant que Node ne le reçoive. ' +
    'Exportez MSYS_NO_PATHCONV=1 avant de lancer ce script (déjà fait automatiquement par ' +
    'test-scalabilite.sh), ou lancez-le depuis un autre shell (PowerShell, CMD, WSL).'
  );
}
const concurrency = Math.max(1, Number.parseInt(process.argv[2] || '10', 10));
const durationMs = Math.max(1000, Number.parseInt(process.env.LOAD_DURATION || '10', 10) * 1000);
const tokenFile = process.env.LOAD_TOKENS_FILE || path.join(process.cwd(), 'resultats-charge', 'load-test-tokens.json');
const perUserRps = Math.max(1, Number(process.env.LOAD_PER_USER_RPS || '5'));
const minIntervalMs = Math.floor(1000 / perUserRps);
const tokens = endpoint === '/api/health' ? [] : JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
if (endpoint !== '/api/health' && (!Array.isArray(tokens) || tokens.length < concurrency)) throw new Error(`Il faut au moins ${concurrency} tokens distincts (${tokenFile}).`);

const latencies=[]; const codes=new Map(); const errorKinds=new Map(); let errors=0, timeouts=0, total=0; let stop=false;
function percentile(p){ if(!latencies.length) return 0; const a=[...latencies].sort((x,y)=>x-y); return a[Math.min(a.length-1, Math.ceil(p*a.length)-1)]; }
// Identifiant court et stable pour regrouper les erreurs dans le récapitulatif : code
// d'erreur système (ECONNRESET, ECONNREFUSED...), cause undici imbriquée (fetch enveloppe
// souvent l'erreur réseau réelle dans err.cause), sinon le nom/message brut. Sans ceci,
// toute erreur réseau — y compris un simple "connexion refusée" — atterrissait dans un seul
// compteur "errors" indistinct, masquant la cause réelle (voir /api/health, run du 31/08).
function errorKind(e){
  return e?.cause?.code || e?.code || e?.cause?.name || e?.name || (e?.message ? String(e.message).slice(0,60) : 'inconnu');
}
async function one(i){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(), Math.max(1000, durationMs+5000));
  const started=performance.now();
  try {
    const t=tokens.length ? tokens[i % tokens.length] : null;
    const headers=t ? {authorization:`Bearer ${t.token}`} : {};
    const res=await fetch(`${API_URL}${endpoint}`, {headers, signal:controller.signal});
    const ms=performance.now()-started; latencies.push(ms); total++; codes.set(res.status,(codes.get(res.status)||0)+1);
  } catch(e){
    total++;
    if(e.name==='AbortError') timeouts++; else errors++;
    const kind=errorKind(e);
    errorKinds.set(kind,(errorKinds.get(kind)||0)+1);
  }
  finally { clearTimeout(timer); }
  if (!stop && minIntervalMs > 0) await new Promise(r => setTimeout(r, minIntervalMs));
}
async function worker(i){ while(!stop){ await one(i); } }
(async()=>{
  const started=Date.now(); const workers=Array.from({length:concurrency},(_,i)=>worker(i));
  await new Promise(r=>setTimeout(r,durationMs)); stop=true; await Promise.all(workers);
  const elapsed=(Date.now()-started)/1000;
  const non2xx=[...codes].filter(([c])=>c<200||c>=300).reduce((n,[,v])=>n+v,0);
  const result={concurrency,duration_s:elapsed,total,requests_per_second:total/elapsed,latency_ms:{average:latencies.reduce((a,b)=>a+b,0)/(latencies.length||1),p95:percentile(.95),p99:percentile(.99)},errors,timeouts,non2xx,status_codes:Object.fromEntries(codes),error_kinds:Object.fromEntries(errorKinds)};
const resultFile=process.env.LOAD_RESULT_FILE; if(resultFile){fs.mkdirSync(require('node:path').dirname(resultFile),{recursive:true});fs.writeFileSync(resultFile,JSON.stringify(result,null,2));}
  console.log(`  Requêtes/s (moyenne) : ${result.requests_per_second.toFixed(1)}`);
  console.log(`  Latence moyenne      : ${result.latency_ms.average.toFixed(1)} ms (p95 : ${result.latency_ms.p95.toFixed(1)} ms, p99 : ${result.latency_ms.p99.toFixed(1)} ms)`);
  console.log(`  Erreurs / Timeouts   : ${errors} / ${timeouts}`);
  if (errorKinds.size) console.log(`  Détail des erreurs   : ${[...errorKinds].map(([k,n])=>`${k}:${n}`).join(' ')}`);
  console.log(`  Codes non-2xx        : ${non2xx}`);
  console.log(`  Codes HTTP           : ${[...codes].map(([c,n])=>`${c}:${n}`).join(' ') || 'aucun'}`);
  const ok=errors===0&&timeouts===0&&non2xx===0; console.log(`  Verdict              : ${ok?'PASS':'FAIL'}`); process.exitCode=ok?0:10;
})().catch(e=>{console.error(`❌ ${e.stack||e}`);process.exit(1);});
