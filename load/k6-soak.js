import http from 'k6/http';
import { check, sleep } from 'k6';

const base = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const token = __ENV.LOAD_TEST_TOKEN || '';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: Number(__ENV.SOAK_VUS || 1000),
      duration: __ENV.SOAK_DURATION || '15m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  },
};

export default function () {
  const params = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  const endpoints = token
    ? ['/api/auth/me', '/api/dashboard', '/api/clients?page=1&limite=20', '/api/produits?page=1&limite=20', '/api/factures?page=1&limite=20']
    : ['/api/health', '/api/ready'];
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const r = http.get(`${base}${endpoint}`, params);
  check(r, { 'HTTP < 400': x => x.status < 400 });
  sleep(0.5);
}
