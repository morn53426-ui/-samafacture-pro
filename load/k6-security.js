import http from 'k6/http';
import { check } from 'k6';

const base = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export const options = {
  scenarios: {
    security_load: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.SECURITY_RPS || 50),
      timeUnit: '1s',
      duration: __ENV.SECURITY_DURATION || '60s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.20'],
  },
};

export default function () {
  const r = http.get(`${base}/api/dashboard`, { headers: { Authorization: 'Bearer invalid-test-token' } });
  // 401/429 sont attendus selon le rate limiter. Un 5xx est une vraie régression.
  check(r, { 'security response is 401 or 429': x => x.status === 401 || x.status === 429 });
  if (r.status >= 500) throw new Error(`Unexpected HTTP ${r.status}`);
}
