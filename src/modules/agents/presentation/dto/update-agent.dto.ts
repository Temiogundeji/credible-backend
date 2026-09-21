import { PartialType } from '@nestjs/swagger';
import { CreateAgentDto } from './create-agent.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateAgentDto extends PartialType(CreateAgentDto) {
  @ApiProperty({ example: 1, minimum: 1, description: 'Version read by the client before editing.' })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
