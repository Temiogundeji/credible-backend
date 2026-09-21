import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class AssignTerritoryDto {
  @ApiProperty({ example: 'Ikeja' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  territory!: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z', format: 'date-time' })
  @IsDateString()
  effectiveFrom!: string;
}
