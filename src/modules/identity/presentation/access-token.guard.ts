import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { IDENTITY_PORTS, TokenService } from '../domain/identity-ports';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    agencyId: string;
    roles: readonly string[];
    sessionId: string;
  };
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(IDENTITY_PORTS.TokenService) private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException();

    try {
      const claims = await this.tokens.verifyAccessToken(token);
      request.user = {
        id: claims.userId,
        agencyId: claims.agencyId,
        roles: claims.roles,
        sessionId: claims.sessionId,
      };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
