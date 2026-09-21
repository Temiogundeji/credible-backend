import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

class BatchContributorRowDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(50) referenceNumber!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) fullName!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) address?: string;
}

export class BatchContributorsDto {
  @ApiProperty({ type: [BatchContributorRowDto], maxItems: 500 })
  @IsArray() @ValidateNested({ each: true }) @Type(() => BatchContributorRowDto)
  rows!: BatchContributorRowDto[];
}
