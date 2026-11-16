import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from '@resend/resend';

/**
 * Wrapper around Resend email API. All outbound emails go through this class.
 */
@Injectable()
export class EmailService {
  private readonly client: ReturnType<typeof Resend>;

  constructor(config: ConfigService) {
    const apiKey = config.getOrThrow<string>('RESEND_API_KEY');
    this.client = new Resend({ apiKey });
  }

  async sendVerificationEmail(input: {
    recipient: string;
    token: string;
    verificationUrl: string;
  }): Promise<void> {
    await this.client.emails.send({
      from: 'no-reply@credible.example.com',
      to: [input.recipient],
      subject: 'Verify your email address',
      html: `<p>Please verify your email by clicking the link below:</p><a href="${input.verificationUrl}">Verify Email</a>`,
    });
  }

  async sendPasswordResetEmail(input: {
    recipient: string;
    token: string;
    resetUrl: string;
  }): Promise<void> {
    await this.client.emails.send({
      from: 'no-reply@credible.example.com',
      to: [input.recipient],
      subject: 'Credible password reset',
      html: `<p>You requested a password reset. Click the link below to set a new password:</p><a href="${input.resetUrl}">Reset Password</a>`,
    });
  }

  async sendContributorInvitationEmail(input: {
    recipient: string;
    token: string;
    invitationUrl: string;
  }): Promise<void> {
    await this.client.emails.send({
      from: 'no-reply@credible.example.com',
      to: [input.recipient],
      subject: 'You are invited to join Credible',
      html: `<p>Click the link below to accept the invitation and set your password:</p><a href="${input.invitationUrl}">Accept Invitation</a>`,
    });
  }
}
