import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ minLength: 32, maxLength: 512, writeOnly: true })
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  refreshToken!: string;
}
