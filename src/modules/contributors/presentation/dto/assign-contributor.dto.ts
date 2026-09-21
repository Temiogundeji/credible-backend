import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class AssignContributorDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  agentId!: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z', format: 'date-time' })
  @IsDateString()
  effectiveFrom!: string;
}
