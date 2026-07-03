import {
  IsISO4217CurrencyCode,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCardRegistrationSessionDto {
  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;
}

export class CompleteCardRegistrationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorizationReference?: string;
}
