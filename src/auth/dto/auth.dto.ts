import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  // IsISO31661Alpha2,
  // IsISO4217CurrencyCode,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
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
  @IsNotEmpty()
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

export class VerifyEmailDto {
  @ApiProperty({
    name: 'User email',
    type: 'string',
    example: 'john@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email!: string;
}

export class CompleteEmailVerificationDto {
  @ApiProperty({
    name: 'email',
    type: 'string',
    example: 'johndoe@mail.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

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
  // @ApiProperty({
  //   name: 'User email',
  //   type: 'string',
  //   example: 'john@example.com',
  // })
  // @IsEmail()
  // email!: string;

  @ApiProperty({
    name: 'phoneNumber',
    type: 'string',
    example: '+1234567890',
  })
  @IsPhoneNumber()
  phoneNumber!: string;

  @ApiProperty({
    name: 'password',
    type: 'string',
    example: 'password123',
  })
  @IsString()
  @IsStrongPassword({ minLength: 8 })
  password!: string;

  // @ApiProperty({
  //   name: 'User payment tag',
  //   type: 'string',
  //   example: 'johndoe',
  // })
  // @IsString()
  // @MinLength(3)
  // @MaxLength(31)
  // paymentTag!: string;

  @ApiProperty({
    name: 'firstName',
    type: 'string',
    example: 'John',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    name: 'lastName',
    type: 'string',
    example: 'Doe',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    name: 'dateOfBirth',
    type: 'string',
    example: '1990-01-01',
  })
  @IsDateString()
  dateOfBirth!: string;

  // @ApiProperty({
  //   name: 'country',
  //   type: 'string',
  //   example: 'NG',
  // })
  // @IsISO31661Alpha2()
  // country!: string;

  // @ApiProperty({
  //   name: 'defaultCurrency',
  //   type: 'string',
  //   example: 'NGN',
  // })
  // @IsISO4217CurrencyCode()
  // defaultCurrency!: string;
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

export class VerifyEmailTokenDto {
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
