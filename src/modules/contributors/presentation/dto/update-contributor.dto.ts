import { PartialType, ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { CreateContributorDto } from './create-contributor.dto';

export class UpdateContributorDto extends PartialType(CreateContributorDto) {
  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt() @Min(1)
  expectedVersion!: number;
}
