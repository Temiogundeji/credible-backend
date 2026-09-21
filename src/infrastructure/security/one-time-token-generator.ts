import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { OneTimeTokenGenerator } from '../../modules/identity/domain/identity-ports';

@Injectable()
export class CryptoOneTimeTokenGenerator implements OneTimeTokenGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('base64url');
  }
}
