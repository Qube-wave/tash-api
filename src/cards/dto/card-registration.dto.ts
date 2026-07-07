import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsISO4217CurrencyCode,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCardRegistrationSessionDto {
  @ApiPropertyOptional({
    description:
      'Email address to attach to the provider card registration order.',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Currency for the card registration order.',
    example: 'NGN',
  })
  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;
}

export class CompleteCardRegistrationDto {
  @ApiPropertyOptional({
    description:
      'Provider authorization reference, when supplied by a client flow.',
    example: 'auth_ref_123456',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorizationReference?: string;
}

export class SubmitCardDetailsDto {
  @ApiProperty({
    description:
      'Primary account number submitted directly to the payment provider.',
    example: '4111111111111111',
    minLength: 12,
    maxLength: 19,
  })
  @IsString()
  @MinLength(12)
  @MaxLength(19)
  cardNumber!: string;

  @ApiProperty({
    description: 'Two-digit card expiry month.',
    example: '12',
    minLength: 2,
    maxLength: 2,
  })
  @IsString()
  @Length(2, 2)
  expiryMonth!: string;

  @ApiProperty({
    description: 'Two- or four-digit card expiry year.',
    example: '2030',
    minLength: 2,
    maxLength: 4,
  })
  @IsString()
  @Length(2, 4)
  expiryYear!: string;

  @ApiProperty({
    description:
      'Card security code submitted directly to the payment provider.',
    example: '123',
    minLength: 3,
    maxLength: 4,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(4)
  cvv!: string;

  @ApiPropertyOptional({
    description: 'Name printed on the card, if available.',
    example: 'Tash User',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cardholderName?: string;

  @ApiPropertyOptional({
    description: 'Four-digit card PIN when required by the provider.',
    example: '1234',
    minLength: 4,
    maxLength: 4,
  })
  @IsOptional()
  @IsString()
  @Length(4, 4)
  cardPin?: string;
}

export class SubmitCardOtpDto {
  @ApiProperty({
    description: 'OTP sent by the payment provider for card authorization.',
    example: '123456',
    minLength: 4,
    maxLength: 8,
  })
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  otp!: string;
}
