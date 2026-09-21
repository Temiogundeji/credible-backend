import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from './access-token.guard';
import { AccessTokenGuard } from './access-token.guard';
import { MfaSettingsService } from '../application/mfa-settings.service';
import { ConfirmMfaEnrollmentDto } from './dto/confirm-mfa-enrollment.dto';

@Controller({ path: 'auth/mfa', version: '1' })
@UseGuards(AccessTokenGuard)
@ApiTags('Authentication settings')
@ApiBearerAuth('access-token')
export class MfaSettingsController {
  constructor(private readonly settings: MfaSettingsService) {}

  @Get('factors')
  @ApiOperation({ summary: 'List the authenticated user MFA factors' })
  factors(@Req() request: AuthenticatedRequest): Promise<readonly { type: string; enabledAt: Date }[]> {
    if (!request.user) throw new Error('Authenticated user is missing');
    return this.settings.listFactors(request.user.id).then((items) => items.map((item) => ({ type: item.type, enabledAt: item.enabledAt })));
  }

  @Post('totp/enroll')
  @ApiOperation({ summary: 'Begin optional TOTP MFA enrollment' })
  begin(@Req() request: AuthenticatedRequest): Promise<{ challengeId: string; enrollmentData: string }> {
    if (!request.user) throw new Error('Authenticated user is missing');
    return this.settings.beginTotpEnrollment({ userId: request.user.id });
  }

  @Post('totp/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm TOTP enrollment with an authenticator code' })
  confirm(@Req() request: AuthenticatedRequest, @Body() body: ConfirmMfaEnrollmentDto): Promise<{ type: string; enabledAt: Date }> {
    if (!request.user) throw new Error('Authenticated user is missing');
    return this.settings.confirmTotpEnrollment({ userId: request.user.id, agencyId: request.user.agencyId, challengeId: body.challengeId, code: body.code }).then((item) => ({ type: item.type, enabledAt: item.enabledAt }));
  }
}
