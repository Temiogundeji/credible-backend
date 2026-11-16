import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  OneTimeTokenRepository,
  EmailService,
  AuthenticationEventWriter,
} from '../../domain/identity-ports';
import { UserId } from '../../domain/identity-types';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly tokenRepo: OneTimeTokenRepository,
    private readonly emailService: EmailService,
    private readonly eventWriter: AuthenticationEventWriter,
    private readonly config: ConfigService,
  ) {}

  /** Create a reset token and email it */
  async requestReset(email: string) {
    // TODO: inject UserRepository – placeholder implementation
    const user = await this.findUserByEmail(email);
    if (!user) {
      // Emit event but do not reveal existence
      await this.eventWriter.write({
        type: 'password_reset_requested',
        occurredAt: new Date(),
        metadata: { email },
      });
      return;
    }

    const raw = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(raw).digest('hex');
    await this.tokenRepo.issue({
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
    });

    const resetUrl = `${this.config.get<string>('WEB_APP_URL')}/reset-password?token=${raw}`;
    await this.emailService.sendPasswordResetEmail({
      recipient: email,
      token: raw,
      resetUrl,
    });

    await this.eventWriter.write({
      userId: user.id,
      type: 'password_reset_requested',
      occurredAt: new Date(),
    });
  }

  async resetPassword(input: { token: string; newPassword: string; userId: UserId }) {
    const hash = createHash('sha256').update(input.token).digest('hex');
    const token = await this.tokenRepo.consumeValid({
      purpose: 'password_reset',
      tokenHash: hash,
      consumedAt: new Date(),
    });
    if (!token) {
      throw new BadRequestException('Invalid or expired token');
    }
    // TODO: call CredentialRepository to hash and store new password
    await this.updatePassword(input.userId, input.newPassword);
    await this.eventWriter.write({
      userId: input.userId,
      type: 'password_changed',
      occurredAt: new Date(),
    });
  }

  // ----- Stubs to be replaced with real repos -----
  private async findUserByEmail(email: string): Promise<{ id: UserId; roles: string[] } | null> {
    return null; // implement using UserRepository
  }

  private async updatePassword(userId: UserId, newPassword: string) {
    // hash password using PasswordHasher and store via CredentialRepository
  }
}
