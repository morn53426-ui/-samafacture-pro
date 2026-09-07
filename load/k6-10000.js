import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const base = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const email = __ENV.LOAD_TEST_EMAIL || '';
const password = __ENV.LOAD_TEST_PASSWORD || '';
const suppliedToken = __ENV.LOAD_TEST_TOKEN || '';
const suppliedTokens = (__ENV.LOAD_TEST_TOKENS || '').split(',').map(x => x.trim()).filter(Boolean);
const tokenFile = __ENV.LOAD_TEST_TOKENS_FILE || '';
const fileTokens = tokenFile ? new SharedArray('load-test-tokens', () => JSON.parse(open(tokenFile))) : [];
const apiErrors = new Rate('api_errors');
const apiLatency = new Trend('api_latency', true);
const http4xx = new Counter('http_4xx');
const http5xx = new Counter('http_5xx');

export const options = {
  scenarios: {
    business_load: {
      executor: 'ramping-vus', startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '3m', target: 500 },
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 5000 },
        { duration: '5m', target: 10000 },
        { duration: '3m', target: 10000 },
        { duration: '2m', target: 0 },
      ], gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

function request(method, path, token, body = null) {
  const params = { headers: { Authorization: `Bearer ${token}` }, tags: { endpoint: path } };
  const r = method === 'GET' ? http.get(`${base}${path}`, params) : http(method, `${base}${path}`, body ? JSON.stringify(body) : null, { ...params, headers: { ...params.headers, 'Content-Type': 'application/json' } });
  apiLatency.add(r.timings.duration);
  apiErrors.add(r.status >= 400);
  if (r.status >= 400 && r.status < 500) http4xx.add(1);
  if (r.status >= 500) http5xx.add(1);
  check(r, { [`${method} ${path} < 400`]: x => x.status < 400 });
  return r;
}

export function setup() {
  if (fileTokens.length) return { tokens: fileTokens };
  if (suppliedTokens.length) return { tokens: suppliedTokens };
  if (suppliedToken) return { tokens: [suppliedToken] };
  if (!email || !password) throw new Error('Définissez LOAD_TEST_TOKEN ou LOAD_TEST_EMAIL + LOAD_TEST_PASSWORD.');
  const r = http.post(`${base}/api/auth/login`, JSON.stringify({ email, password }), { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } });
  check(r, { 'login 200': x => x.status === 200 });
  if (r.status !== 200) throw new Error(`Login de charge impossible: HTTP ${r.status}`);
  return { tokens: [r.json('token')] };
}

export default function (data) {
  const tokens = data.tokens || [];
  if (!tokens.length) throw new Error('Aucun jeton de charge disponible.');
  // __VU permet d'utiliser des comptes/tokens distincts lorsque LOAD_TEST_TOKENS est fourni.
  // Avec un seul token, le comportement historique reste compatible.
  const token = tokens[(__VU - 1) % tokens.length];
  const roll = Math.random();
  if (roll < 0.25) request('GET', '/api/auth/me', token);
  else if (roll < 0.45) request('GET', '/api/dashboard', token);
  else if (roll < 0.62) request('GET', '/api/clients?page=1&limite=20', token);
  else if (roll < 0.77) request('GET', '/api/produits?page=1&limite=20', token);
  else if (roll < 0.93) request('GET', '/api/factures?page=1&limite=20', token);
  else request('GET', '/api/rapports/ventes', token);
  sleep(Math.max(0.1, Math.random() * 1.5));
}
