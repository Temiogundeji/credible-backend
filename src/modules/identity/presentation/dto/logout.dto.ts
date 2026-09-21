import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sessionId!: string;
}
