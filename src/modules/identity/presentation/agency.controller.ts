import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import type { AuthenticatedRequest } from './access-token.guard';
import { AccessTokenGuard } from './access-token.guard';
import { AgencyRepository, IDENTITY_PORTS } from '../domain/identity-ports';
import type { Agency } from '../domain/identity-types';

/**
 * Read-only agency reference data. Every authenticated member may read the
 * minimal agency shape (legal name, timezone, currency, status) because
 * business-date and currency rendering depend on it on every screen; the
 * permission matrix restricts agency *settings* management, not this reference
 * read. Field-level authorization for settings updates belongs to the
 * authorization guard slice.
 */
@Controller({ path: 'agency', version: '1' })
@ApiTags('Agency')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
export class AgencyController {
  constructor(@Inject(IDENTITY_PORTS.AgencyRepository) private readonly agencies: AgencyRepository) {}

  @Get()
  @ApiOperation({ summary: 'Read the authenticated member agency reference data' })
  async getAgency(@Req() request: AuthenticatedRequest): Promise<Agency> {
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication is required.');
    const agency = await this.agencies.findById(user.agencyId);
    if (!agency) throw new ForbiddenException('The agency could not be found.');
    return agency;
  }
}
