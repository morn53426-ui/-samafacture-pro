import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const base = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const token = __ENV.LOAD_TEST_TOKEN || '';
const errors = new Rate('spike_errors');

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 500 },
        { duration: '30s', target: 1000 },
        { duration: '15s', target: 5000 },
        { duration: '60s', target: 5000 },
        { duration: '45s', target: 500 },
        { duration: '60s', target: 50 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    spike_errors: ['rate<0.01'],
  },
};

export default function () {
  const params = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  const r = http.get(`${base}/api/ready`, params);
  const failed = r.status >= 400;
  errors.add(failed);
  check(r, { 'ready < 400': x => x.status < 400 });
  sleep(0.2);
}
