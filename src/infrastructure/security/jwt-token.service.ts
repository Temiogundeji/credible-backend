import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { AgencyId, SessionId, UserId } from '../../modules/identity/domain/identity-types';
import { TokenService } from '../../modules/identity/domain/identity-ports';

@Injectable()
export class JwtTokenService implements TokenService {
  private readonly secret: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly keyId: string;

  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>('app.accessTokenSecret');
    if (secret.length < 32) throw new Error('ACCESS_TOKEN_SECRET must contain at least 32 characters');
    this.secret = new TextEncoder().encode(secret);
    this.issuer = config.getOrThrow<string>('app.accessTokenIssuer');
    this.audience = config.getOrThrow<string>('app.accessTokenAudience');
    this.keyId = config.getOrThrow<string>('app.accessTokenKeyId');
  }

  async issueAccessToken(input: {
    userId: UserId;
    agencyId: AgencyId;
    roles: readonly string[];
    sessionId: SessionId;
    issuedAt: Date;
    expiresAt: Date;
  }): Promise<string> {
    return new SignJWT({
      agencyId: input.agencyId,
      roles: input.roles,
      sid: input.sessionId,
    })
      .setProtectedHeader({ alg: 'HS256', kid: this.keyId, typ: 'JWT' })
      .setSubject(input.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(Math.floor(input.issuedAt.getTime() / 1000))
      .setExpirationTime(Math.floor(input.expiresAt.getTime() / 1000))
      .setJti(randomBytes(16).toString('base64url'))
      .sign(this.secret);
  }

  issueRefreshToken(): Promise<string> {
    return Promise.resolve(randomBytes(32).toString('base64url'));
  }

  hashRefreshToken(token: string): Promise<string> {
    return Promise.resolve(createHash('sha256').update(token, 'utf8').digest('base64url'));
  }

  async verifyAccessToken(token: string): Promise<{
    userId: UserId;
    agencyId: AgencyId;
    roles: readonly string[];
    sessionId: SessionId;
  }> {
    const { payload, protectedHeader } = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
      issuer: this.issuer,
      audience: this.audience,
    });
    if (protectedHeader.kid !== this.keyId || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw new Error('Invalid access token claims');
    }
    if (typeof payload.agencyId !== 'string' || !Array.isArray(payload.roles) || !payload.roles.every((role) => typeof role === 'string')) {
      throw new Error('Invalid access token claims');
    }
    return {
      userId: payload.sub,
      agencyId: payload.agencyId,
      roles: payload.roles,
      sessionId: payload.sid,
    };
  }
}
