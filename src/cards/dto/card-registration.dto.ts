import {
  IsISO4217CurrencyCode,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
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

export class SubmitCardDetailsDto {
  @IsString()
  @MinLength(12)
  @MaxLength(19)
  cardNumber!: string;

  @IsString()
  @Length(2, 2)
  expiryMonth!: string;

  @IsString()
  @Length(2, 4)
  expiryYear!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4)
  cvv!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cardholderName?: string;
}

export class SubmitCardOtpDto {
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  otp!: string;
}
