import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { authenticator } from 'otplib';
import {
  MfaFactorRepository,
  MfaService,
  MfaFactor,
} from '../../domain/identity-ports';
import { UserId } from '../../domain/identity-types';

/**
 * Admin‑only MFA service. Secrets are stored encrypted with AES‑256‑GCM.
 * The encryption key is supplied via the environment variable `MFA_ENCRYPTION_KEY`
 * (base64‑encoded 32‑byte key).
 */
@Injectable()
export class AdminMfaService implements MfaService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly config: ConfigService,
    private readonly factorRepo: MfaFactorRepository,
  ) {
    const keyBase64 = this.config.getOrThrow<string>('MFA_ENCRYPTION_KEY');
    this.encryptionKey = Buffer.from(keyBase64, 'base64'); // 32‑byte key for AES‑256‑GCM
  }

  private encryptSecret(secret: string): string {
    const iv = randomBytes(12); // GCM nonce length
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Store as base64url(iv|authTag|ciphertext)
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64url');
  }

  private decryptSecret(protectedRef: string): string {
    const data = Buffer.from(protectedRef, 'base64url');
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }

  async beginEnrollment(input: {
    userId: UserId;
    factorType: MfaFactor['type'];
  }): Promise<{ challengeId: string; enrollmentData: string }> {
    // Generate a new TOTP secret (Base32)
    const rawSecret = authenticator.generateSecret();
    const protectedRef = this.encryptSecret(rawSecret);

    const factor = await this.factorRepo.create({
      userId: input.userId,
      factorType: input.factorType,
      protectedSecretReference: protectedRef,
      enabledAt: new Date(),
    });

    const label = encodeURIComponent(`Credible:${input.userId}`);
    const otpauth = `otpauth://totp/${label}?secret=${rawSecret}&issuer=Credible`;
    return { challengeId: factor.id, enrollmentData: otpauth };
  }

  async verify(input: {
    userId: UserId;
    challengeId: string;
    code: string;
  }): Promise<boolean> {
    const stored = await this.factorRepo.findActiveSecret(input.userId, 'totp');
    if (!stored || stored.id !== input.challengeId) {
      throw new NotFoundException('MFA factor not found');
    }
    const secret = this.decryptSecret(stored.protectedSecretReference);
    return authenticator.check(input.code, secret);
  }

  // Admin MFA does not expose a generic challenge flow.
  async beginChallenge(): Promise<{ challengeId: string }> {
    throw new NotFoundException('Admin MFA does not support generic challenges');
  }
}
