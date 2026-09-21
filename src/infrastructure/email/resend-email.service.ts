import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../modules/identity/domain/identity-ports';

@Injectable()
export class ResendEmailService implements EmailService {
  private readonly apiKey: string;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('app.resendApiKey');
    this.from = config.getOrThrow<string>('app.emailFrom');
  }

  async sendVerificationEmail(input: { recipient: string; token: string; verificationUrl: string }): Promise<void> {
    const response = await globalThis.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.recipient],
        subject: 'Verify your Credible account',
        html: `<p>Verify your Credible account by using this link:</p><p><a href="${escapeHtml(input.verificationUrl)}?token=${encodeURIComponent(input.token)}">Verify account</a></p><p>This link expires in 15 minutes.</p>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Resend email request failed with status ${response.status}`);
  }

  async sendPasswordResetEmail(input: { recipient: string; token: string; resetUrl: string }): Promise<void> {
    await this.sendEmail({
      recipient: input.recipient,
      subject: 'Reset your Credible password',
      html: `<p>Reset your Credible password by using this link:</p><p><a href="${escapeHtml(input.resetUrl)}?token=${encodeURIComponent(input.token)}">Reset password</a></p><p>This link expires in 15 minutes.</p>`,
    });
  }

  async sendContributorInvitationEmail(input: { recipient: string; token: string; invitationUrl: string }): Promise<void> {
    await this.sendEmail({
      recipient: input.recipient,
      subject: 'You have been invited to Credible',
      html: `<p>You have been invited to join Credible.</p><p><a href="${escapeHtml(input.invitationUrl)}?token=${encodeURIComponent(input.token)}">Accept invitation</a></p><p>This link expires in 24 hours.</p>`,
    });
  }

  private async sendEmail(input: { recipient: string; subject: string; html: string }): Promise<void> {
    const response = await globalThis.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [input.recipient], subject: input.subject, html: input.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Resend email request failed with status ${response.status}`);
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
