import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import Redis from 'ioredis';
import { IDENTITY_PORTS, MfaFactorRepository, MfaService } from '../../modules/identity/domain/identity-ports';
import { MfaFactor } from '../../modules/identity/domain/identity-types';

interface MfaChallenge {
  readonly userId: string;
  readonly factorType: MfaFactor['type'];
  readonly secret: string;
  readonly enrollment: boolean;
}

@Injectable()
export class TotpMfaService implements MfaService, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly encryptionKey: Buffer;
  private readonly challengeTtlSeconds: number;

  constructor(
    config: ConfigService,
    @Inject(IDENTITY_PORTS.MfaFactorRepository) private readonly factors: MfaFactorRepository,
  ) {
    const key = config.getOrThrow<string>('app.mfaEncryptionKey');
    if (key.length !== 32) throw new Error('MFA_ENCRYPTION_KEY must contain exactly 32 characters');
    this.encryptionKey = Buffer.from(key, 'utf8');
    this.challengeTtlSeconds = config.getOrThrow<number>('app.mfaChallengeTtlSeconds');
    this.redis = new Redis(config.getOrThrow<string>('app.redisUrl'), { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  async beginChallenge(input: { userId: string; factorType: MfaFactor['type'] }): Promise<{ challengeId: string }> {
    if (input.factorType !== 'totp') throw new Error('Passkey MFA provider is not configured');
    const factor = await this.factors.findActiveSecret(input.userId, input.factorType);
    if (!factor) throw new Error('MFA factor is not configured');
    const challengeId = randomBytes(24).toString('base64url');
    await this.saveChallenge(challengeId, {
      userId: input.userId,
      factorType: input.factorType,
      secret: this.decrypt(factor.protectedSecretReference),
      enrollment: false,
    });
    return { challengeId };
  }

  async beginEnrollment(input: { userId: string; factorType: MfaFactor['type'] }): Promise<{ challengeId: string; enrollmentData: string }> {
    if (input.factorType !== 'totp') throw new Error('Passkey MFA provider is not configured');
    const secret = encodeBase32(randomBytes(20));
    const challengeId = randomBytes(24).toString('base64url');
    await this.saveChallenge(challengeId, {
      userId: input.userId,
      factorType: input.factorType,
      secret,
      enrollment: true,
    });
    return {
      challengeId,
      enrollmentData: `otpauth://totp/Credible:${encodeURIComponent(input.userId)}?secret=${secret}&issuer=Credible`,
    };
  }

  async verify(input: { userId: string; challengeId: string; code: string }): Promise<boolean> {
    const challenge = await this.consumeChallenge(input.challengeId);
    if (!challenge || challenge.userId !== input.userId || !/^\d{6}$/.test(input.code)) return false;
    if (!verifyTotp(challenge.secret, input.code)) return false;
    if (challenge.enrollment) {
      await this.factors.create({
        userId: challenge.userId,
        factorType: challenge.factorType,
        protectedSecretReference: this.encrypt(challenge.secret),
        enabledAt: new Date(),
      });
    }
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') await this.redis.quit();
  }

  private async saveChallenge(id: string, challenge: MfaChallenge): Promise<void> {
    await this.ensureConnected();
    await this.redis.set(`credible:mfa:challenge:${id}`, JSON.stringify(challenge), 'EX', this.challengeTtlSeconds);
  }

  private async consumeChallenge(id: string): Promise<MfaChallenge | null> {
    await this.ensureConnected();
    const key = `credible:mfa:challenge:${id}`;
    const value = await this.redis.getdel(key);
    if (!value) return null;
    return JSON.parse(value) as MfaChallenge;
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'ready') return;
    if (this.redis.status === 'wait') await this.redis.connect();
    if (String(this.redis.status) !== 'ready') throw new Error('Redis MFA challenge store is unavailable');
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
  }

  private decrypt(value: string): string {
    const [ivValue, tagValue, encryptedValue] = value.split('.');
    if (!ivValue || !tagValue || !encryptedValue) throw new Error('Invalid protected MFA secret');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
  }
}

function verifyTotp(secret: string, code: string): boolean {
  const counter = Math.floor(Date.now() / 1000 / 30);
  return [-1, 0, 1].some((offset) => {
    const expected = totp(secret, counter + offset);
    return timingSafeEqual(Buffer.from(expected), Buffer.from(code));
  });
}

function totp(secret: string, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, '0');
}

function encodeBase32(value: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  let output = '';
  for (const byte of value) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const character of value.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 MFA secret');
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
