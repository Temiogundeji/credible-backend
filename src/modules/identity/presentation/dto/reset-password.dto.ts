import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ minLength: 32, maxLength: 512, writeOnly: true })
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ minLength: 15, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(15)
  @MaxLength(128)
  newPassword!: string;
}
