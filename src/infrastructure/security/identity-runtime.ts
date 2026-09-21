import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IdentityClock, IdentityIdGenerator } from '../../modules/identity/application/authentication.service';

@Injectable()
export class SystemIdentityClock implements IdentityClock {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class CryptoIdentityIdGenerator implements IdentityIdGenerator {
  generate(): string {
    return randomUUID();
  }
}
