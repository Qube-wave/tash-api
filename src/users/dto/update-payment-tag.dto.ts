import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePaymentTagDto {
  @IsString()
  @MinLength(3)
  @MaxLength(31)
  paymentTag!: string;
}
