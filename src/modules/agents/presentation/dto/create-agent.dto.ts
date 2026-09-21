import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAgentDto {
  @ApiProperty({ example: 'AG-0001', minLength: 2, maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  identifier!: string;

  @ApiProperty({ example: 'Amina Yusuf', minLength: 2, maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  displayName!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Existing agency user profile to associate with this agent.' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 'amina@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'Ikeja' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  territory?: string;
}
