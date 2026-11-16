import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, createPrivateKey, createPublicKey } from 'node:crypto';
import { jwtVerify, SignJWT, exportJWK, importJWK } from 'jose';
import { AgencyId, SessionId, UserId } from '../../modules/identity/domain/identity-types';
import { TokenService } from '../../modules/identity/domain/identity-ports';

/**
 * JWT Token Service using RSA (RS256) keys for maximum security.
 * Private key lives only in the backend (Render secret). Public key can be exposed via JWKS endpoint.
 */
@Injectable()
export class JwtTokenService implements TokenService {
  private readonly privateKey: CryptoKey;
  private readonly publicKey: CryptoKey;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly keyId: string;

  constructor(config: ConfigService) {
    // Keys are stored as PEM strings in environment variables
    const privatePem = config.getOrThrow<string>('JWT_PRIVATE_KEY');
    const publicPem = config.getOrThrow<string>('JWT_PUBLIC_KEY');

    // jwk import is async – we use a sync workaround via createPrivateKey/createPublicKey then importJWK
    const priv = createPrivateKey({ key: privatePem, format: 'pem' });
    const pub = createPublicKey({ key: publicPem, format: 'pem' });

    // Import to CryptoKey for jose (which expects CryptoKey objects)
    // Note: importJWK is async, but we can wrap in a Promise and await in a static init if needed.
    // Here we store the PEM objects directly; jose can accept key objects.
    this.privateKey = priv as unknown as CryptoKey;
    this.publicKey = pub as unknown as CryptoKey;

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
      .setProtectedHeader({ alg: 'RS256', kid: this.keyId, typ: 'JWT' })
      .setSubject(input.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(Math.floor(input.issuedAt.getTime() / 1000))
      .setExpirationTime(Math.floor(input.expiresAt.getTime() / 1000))
      .setJti(randomBytes(16).toString('base64url'))
      .sign(this.privateKey);
  }

  // Refresh token stays a random opaque string stored hashed in DB
  issueRefreshToken(): Promise<string> {
    return Promise.resolve(randomBytes(32).toString('base64url'));
  }

  hashRefreshToken(token: string): Promise<string> {
    return Promise.resolve(
      createHash('sha256').update(token, 'utf8').digest('base64url'),
    );
  }

  async verifyAccessToken(token: string): Promise<{
    userId: UserId;
    agencyId: AgencyId;
    roles: readonly string[];
    sessionId: SessionId;
  }> {
    const { payload, protectedHeader } = await jwtVerify(token, this.publicKey, {
      algorithms: ['RS256'],
      issuer: this.issuer,
      audience: this.audience,
    });

    if (
      protectedHeader.kid !== this.keyId ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      throw new Error('Invalid access token claims');
    }
    if (
      typeof payload.agencyId !== 'string' ||
      !Array.isArray(payload.roles) ||
      !payload.roles.every((role) => typeof role === 'string')
    ) {
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
