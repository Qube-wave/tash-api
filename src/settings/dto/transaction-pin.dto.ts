import { IsString, Length } from 'class-validator';

export class CreateTransactionPinDto {
  @IsString()
  @Length(4, 6)
  pin!: string;
}

export class UpdateTransactionPinDto {
  @IsString()
  @Length(4, 6)
  currentPin!: string;

  @IsString()
  @Length(4, 6)
  newPin!: string;
}

export class ResetTransactionPinDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @Length(4, 6)
  newPin!: string;
}
