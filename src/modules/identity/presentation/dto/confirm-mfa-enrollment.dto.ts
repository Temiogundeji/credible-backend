import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ConfirmMfaEnrollmentDto {
  @ApiProperty({ minLength: 6, maxLength: 6, example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty()
  @IsString()
  challengeId!: string;
}
