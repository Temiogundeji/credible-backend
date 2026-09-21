import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { PasswordBlocklist } from '../../modules/identity/domain/auth-policy';

@Injectable()
export class RedisPasswordBlocklist implements PasswordBlocklist, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly key: string;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.getOrThrow<string>('app.redisUrl'), { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.key = config.getOrThrow<string>('app.passwordBlocklistRedisKey');
  }

  async contains(candidate: string): Promise<boolean> {
    if (this.redis.status === 'wait') await this.redis.connect();
    if (String(this.redis.status) !== 'ready') throw new Error('Redis password blocklist is unavailable');
    const digest = createHash('sha256').update(candidate, 'utf8').digest('hex');
    return (await this.redis.sismember(this.key, digest)) === 1;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') await this.redis.quit();
  }
}
