import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../access-token.guard';
import { MfaService } from '../../domain/identity-ports';
import { IDENTITY_PORTS } from '../../domain/identity-ports';
import { Inject } from '@nestjs/common';

class BeginEnrollmentDto {
  factorType: 'totp'; // only TOTP for admin
}

class VerifyDto {
  challengeId: string;
  code: string;
}

@ApiTags('MFA (Admin)')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('auth/mfa')
export class MfaSettingsController {
  constructor(@Inject(IDENTITY_PORTS.MfaService) private readonly mfaService: MfaService) {}

  @Post('enroll')
  @ApiOperation({ summary: 'Start admin MFA enrollment – returns otpauth URL' })
  @ApiResponse({ status: 201, description: 'Enrollment data returned' })
  async beginEnrollment(@Body() body: BeginEnrollmentDto, @Body('userId') userId: string) {
    // In a real request the userId would be read from request.user after the guard.
    const { challengeId, enrollmentData } = await this.mfaService.beginEnrollment({
      userId,
      factorType: body.factorType,
    });
    return { challengeId, enrollmentData };
  }

  @Post('verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Verify admin MFA code' })
  async verify(@Body() body: VerifyDto, @Body('userId') userId: string) {
    const ok = await this.mfaService.verify({
      userId,
      challengeId: body.challengeId,
      code: body.code,
    });
    if (!ok) {
      // Throw generic 401 – not revealing which part failed
      throw new UnauthorizedException('Invalid MFA code');
    }
  }
}
