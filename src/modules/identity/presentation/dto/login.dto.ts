import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'a-password-at-least-15-characters', minLength: 15, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ description: 'MFA challenge identifier returned by a previous login attempt' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  mfaChallengeId?: string;

  @ApiPropertyOptional({ description: 'TOTP code for the active MFA challenge', example: '123456' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  mfaCode?: string;
}
