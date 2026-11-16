import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Simple Termii SMS wrapper.
 */
@Injectable()
export class SmsService {
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly baseUrl = 'https://api.termii.com/api/sms/send';

  constructor(config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('TERMII_API_KEY');
    this.senderId = config.getOrThrow<string>('TERMII_SENDER_ID');
  }

  async sendSms(to: string, message: string): Promise<void> {
    await axios.post(this.baseUrl, {
      to,
      from: this.senderId,
      sms: message,
      type: 'plain',
      api_key: this.apiKey,
    });
  }
}
