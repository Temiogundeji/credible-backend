import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class RecordContributionDto {
  @ApiProperty({ example: '100000', description: 'Minor currency units as a decimal string.' })
  @IsString()
  amountMinor!: string;

  @ApiProperty({ example: 'NGN', minLength: 3, maxLength: 3 })
  @IsString()
  currency!: string;

  @ApiProperty({ enum: ['cash', 'bank_transfer', 'mobile_money'] })
  @IsIn(['cash', 'bank_transfer', 'mobile_money'])
  paymentMethod!: 'cash' | 'bank_transfer' | 'mobile_money';

  @ApiProperty({ example: '2026-09-21', format: 'date' })
  @IsDateString()
  businessDate!: string;

  @ApiProperty({ format: 'uuid', description: 'The active collector/agent who received the savings.' })
  @IsUUID()
  agentId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'The obligation being paid; if omitted, the oldest due obligation is selected.' })
  @IsOptional()
  @IsUUID()
  obligationId?: string;
}
