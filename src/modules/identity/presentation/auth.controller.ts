import { Body, Controller, HttpCode, HttpStatus, Post, Req, UnauthorizedException, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticationService } from '../application/authentication.service';
import { AgencyRegistrationService } from '../application/agency-registration.service';
import type { RegisterAgencyResult } from '../application/agency-registration.service';
import { AccountLifecycleService } from '../application/account-lifecycle.service';
import { AuthenticateResult } from '../application/authentication-contracts';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterAgencyDto } from './dto/register-agency.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AccessTokenGuard } from './access-token.guard';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly registration: AgencyRegistrationService,
    private readonly lifecycle: AccountLifecycleService,
  ) {}

  @Post('register')
  @Version('1')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register an agency and its initial administrator' })
  @ApiResponse({ status: 201, description: 'Agency registration accepted; verification email requested.' })
  @ApiResponse({ status: 409, description: 'Authentication identity already exists.' })
  register(@Body() body: RegisterAgencyDto, @Req() request: Request): Promise<RegisterAgencyResult> {
    return this.registration.register({
      legalName: body.legalName,
      timezone: body.timezone,
      currency: body.currency,
      email: body.email,
      password: body.password,
      correlationId: request.header('X-Correlation-Id') ?? undefined,
    });
  }

  @Post('verify')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Verify an email address using a single-use token' })
  @ApiResponse({ status: 204, description: 'Email verified and agency activated.' })
  async verify(@Body() body: VerifyEmailDto, @Req() request: Request): Promise<void> {
    await this.lifecycle.verifyEmail(body.token, request.header('X-Correlation-Id') ?? undefined);
  }

  @Post('password-reset/request')
  @Version('1')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 202, description: 'Enumeration-safe response.' })
  async requestPasswordReset(@Body() body: RequestPasswordResetDto, @Req() request: Request): Promise<void> {
    await this.lifecycle.requestPasswordReset(body.email, request.header('X-Correlation-Id') ?? undefined);
  }

  @Post('password-reset/complete')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Complete a password reset' })
  @ApiResponse({ status: 204, description: 'Password changed and sessions revoked.' })
  async resetPassword(@Body() body: ResetPasswordDto, @Req() request: Request): Promise<void> {
    await this.lifecycle.resetPassword(body.token, body.newPassword, request.header('X-Correlation-Id') ?? undefined);
  }

  @Post('login')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate a user' })
  @ApiResponse({ status: 200, description: 'Access/refresh tokens or an MFA challenge.' })
  login(@Body() body: LoginDto, @Req() request: Request): Promise<AuthenticateResult> {
    return this.authentication.authenticate({
      email: body.email,
      password: body.password,
      mfaChallengeId: body.mfaChallengeId,
      mfaCode: body.mfaCode,
      userAgent: request.get('user-agent') ?? undefined,
      ipAddress: request.ip,
      correlationId: request.header('X-Correlation-Id') ?? undefined,
    });
  }

  @Post('refresh')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token' })
  @ApiResponse({ status: 200, description: 'New access and refresh tokens.' })
  refresh(@Body() body: RefreshDto, @Req() request: Request): Promise<AuthenticateResult> {
    return this.authentication.refresh({
      refreshToken: body.refreshToken,
      correlationId: request.header('X-Correlation-Id') ?? undefined,
    });
  }

  @Post('logout')
  @Version('1')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke an authenticated session' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: LogoutDto, @Req() request: AuthenticatedRequest): Promise<void> {
    if (!request.user) throw new UnauthorizedException();
    await this.authentication.revoke({
      sessionId: body.sessionId,
      actorUserId: request.user.id,
      correlationId: request.header('X-Correlation-Id') ?? undefined,
    });
  }
}
