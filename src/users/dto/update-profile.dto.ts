import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsISO31661Alpha2,
  IsISO4217CurrencyCode,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    name: 'firstName',
    type: 'string',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    name: 'lastName',
    type: 'string',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    name: 'dateOfBirth',
    type: 'string',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    name: 'country',
    type: 'string',
    example: 'NG',
  })
  @IsOptional()
  @IsISO31661Alpha2()
  country?: string;

  @ApiPropertyOptional({
    name: 'defaultCurrency',
    type: 'string',
    example: 'NGN',
  })
  @IsOptional()
  @IsISO4217CurrencyCode()
  defaultCurrency?: string;
}
