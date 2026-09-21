import { Injectable } from '@nestjs/common';

export interface HealthSnapshot {
  readonly status: 'ok';
  readonly service: 'credible-backend';
  readonly timestamp: string;
}

@Injectable()
export class HealthService {
  snapshot(): HealthSnapshot {
    return {
      status: 'ok',
      service: 'credible-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
