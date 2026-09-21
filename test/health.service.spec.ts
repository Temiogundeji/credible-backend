import { HealthService } from '../src/modules/health/application/health.service';

describe('HealthService', () => {
  it('returns a non-sensitive liveness snapshot', () => {
    const snapshot = new HealthService().snapshot();

    expect(snapshot.status).toBe('ok');
    expect(snapshot.service).toBe('credible-backend');
    expect(Number.isNaN(Date.parse(snapshot.timestamp))).toBe(false);
  });
});
