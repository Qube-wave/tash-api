import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsISO31661Alpha2,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyPhoneNumberDto {
  @ApiProperty({
    name: 'phoneNumber',
    type: 'string',
    example: '+1234567890',
  })
  @IsNotEmpty()
  @IsPhoneNumber()
  phoneNumber!: string;
}

export class CompletePhoneVerificationDto {
  @ApiProperty({
    name: 'phoneNumber',
    type: 'string',
    example: '+1234567890',
  })
  @IsPhoneNumber()
  phoneNumber!: string;

  @ApiProperty({
    name: 'token',
    type: 'string',
    example: '222222',
  })
  @IsNotEmpty()
  @IsString()
  @Length(6)
  token!: string;
}

export class RegisterDto {
  @ApiProperty({
    name: 'User email',
    type: 'string',
    example: 'john@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    name: 'User phone number',
    type: 'string',
    example: '+1234567890',
  })
  @IsPhoneNumber()
  phoneNumber!: string;

  @ApiProperty({
    name: 'User password',
    type: 'string',
    example: 'password123',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({
    name: 'User payment tag',
    type: 'string',
    example: 'johndoe',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(31)
  paymentTag!: string;

  @ApiProperty({
    name: 'User first name',
    type: 'string',
    example: 'John',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    name: 'User last name',
    type: 'string',
    example: 'Doe',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    name: 'User date of birth',
    type: 'string',
    example: '1990-01-01',
  })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({
    name: 'User country',
    type: 'string',
    example: 'US',
  })
  @IsISO31661Alpha2()
  country!: string;

  @ApiProperty({
    name: 'User default currency',
    type: 'string',
    example: 'USD',
  })
  @IsISO4217CurrencyCode()
  defaultCurrency!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}

export class VerifyPhoneDto {
  @IsString()
  @Matches(/^\d{4,8}$/)
  token!: string;
}

export class CreateTransactionPinDuringAuthDto {
  @IsString()
  @Length(4, 6)
  pin!: string;
}
