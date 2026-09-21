import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { AuthenticationRateLimiter } from '../../modules/identity/domain/identity-ports';

@Injectable()
export class RedisAuthenticationRateLimiter implements AuthenticationRateLimiter, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly limit: number;
  private readonly windowSeconds: number;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.getOrThrow<string>('app.redisUrl'), { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.limit = config.getOrThrow<number>('app.loginFailureLimit');
    this.windowSeconds = config.getOrThrow<number>('app.loginFailureWindowSeconds');
  }

  async check(input: { identifier: string; ipAddress?: string }): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    try {
      await this.ensureConnected();
      const keys = this.keys(input);
      const counts = await this.redis.mget(...keys);
      const blocked = counts.some((count) => Number(count ?? 0) >= this.limit);
      return { allowed: !blocked, retryAfterSeconds: blocked ? this.windowSeconds : 0 };
    } catch {
      // Authentication must fail closed when abuse controls are unavailable.
      return { allowed: false, retryAfterSeconds: this.windowSeconds };
    }
  }

  async recordFailure(input: { identifier: string; ipAddress?: string }): Promise<void> {
    await this.ensureConnected();
    const pipeline = this.redis.pipeline();
    for (const key of this.keys(input)) {
      pipeline.incr(key);
      pipeline.expire(key, this.windowSeconds);
    }
    await pipeline.exec();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') await this.redis.quit();
  }

  private keys(input: { identifier: string; ipAddress?: string }): string[] {
    const keys = [`credible:auth:login:account:${hashKey(input.identifier)}`];
    if (input.ipAddress) keys.push(`credible:auth:login:ip:${hashKey(input.ipAddress)}`);
    return keys;
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'ready') return;
    if (this.redis.status === 'wait') await this.redis.connect();
    if (String(this.redis.status) !== 'ready') throw new Error('Redis rate limiter is unavailable');
  }
}

function hashKey(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase(), 'utf8').digest('hex');
}
