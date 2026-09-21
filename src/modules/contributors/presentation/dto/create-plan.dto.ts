import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateContributorPlanDto {
  @ApiProperty({ enum: ['daily', 'weekly'] })
  @IsIn(['daily', 'weekly'])
  frequency!: 'daily' | 'weekly';

  @ApiProperty({ example: '100000', description: 'Minor currency units, represented as a decimal string.' })
  @IsString()
  amountMinor!: string;

  @ApiProperty({ example: 'NGN', minLength: 3, maxLength: 3 })
  @IsString()
  currency!: string;

  @ApiPropertyOptional({ example: '5000000' })
  @IsOptional() @IsString()
  targetMinor?: string;

  @ApiProperty({ example: '2026-10-01', format: 'date' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2027-09-30', format: 'date' })
  @IsOptional() @IsDateString()
  endDate?: string;
}
