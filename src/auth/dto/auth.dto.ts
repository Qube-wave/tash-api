import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum REGISTRATION_TYPE {
  EMAIL = 'email',
  PHONE = 'phone',
}

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
    name: 'email',
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

export class CompleteOnboardingProfileDto {
  @ApiProperty({
    name: 'onboardingSessionToken',
    type: 'string',
    example: 'registration-session-token',
  })
  @IsNotEmpty()
  @IsString()
  onboardingSessionToken!: string;

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
}

export class CompleteOnboardingTagDto {
  @ApiProperty({
    name: 'onboardingSessionToken',
    type: 'string',
    example: 'registration-session-token',
  })
  @IsNotEmpty()
  @IsString()
  onboardingSessionToken!: string;

  @ApiProperty({
    name: 'paymentTag',
    type: 'string',
    example: 'johndoe',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(31)
  paymentTag!: string;
}

export class CompleteOnboardingPinDto {
  @ApiProperty({
    name: 'onboardingSessionToken',
    type: 'string',
    example: 'registration-session-token',
  })
  @IsNotEmpty()
  @IsString()
  onboardingSessionToken!: string;

  @ApiProperty({
    name: 'pin',
    type: 'string',
    example: '1234',
  })
  @IsString()
  @Length(4, 4)
  pin!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class UnlockDto extends RefreshTokenDto {
  @ApiProperty({
    name: 'pin',
    type: 'string',
    example: '1234',
  })
  @IsString()
  @Length(4, 4)
  pin!: string;
}

export class CreateTransactionPinDuringAuthDto {
  @IsString()
  @Length(4, 6)
  pin!: string;
}
