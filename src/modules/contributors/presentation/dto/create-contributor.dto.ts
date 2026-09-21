import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContributorDto {
  @ApiProperty({ example: 'CON-0001', minLength: 2, maxLength: 50 })
  @IsString() @MinLength(2) @MaxLength(50)
  referenceNumber!: string;

  @ApiProperty({ example: 'Amina Yusuf', minLength: 2, maxLength: 200 })
  @IsString() @MinLength(2) @MaxLength(200)
  fullName!: string;

  @ApiPropertyOptional({ example: 'amina@example.com' })
  @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional() @IsObject()
  nextOfKin?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Encrypted or tokenized KYC reference; never a raw identity number.' })
  @IsOptional() @IsString() @MaxLength(200)
  kycReference?: string;
}
