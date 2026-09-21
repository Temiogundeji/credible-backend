import { IsEmail, IsString, IsTimeZone, Length, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterAgencyDto {
  @ApiProperty({ example: 'Credible Agency' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName!: string;

  @ApiProperty({ example: 'Africa/Lagos' })
  @IsTimeZone()
  timezone!: string;

  @ApiProperty({ example: 'NGN', minLength: 3, maxLength: 3 })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 15, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(15)
  @MaxLength(128)
  password!: string;
}
