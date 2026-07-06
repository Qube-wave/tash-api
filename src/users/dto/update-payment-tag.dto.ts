import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePaymentTagDto {
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
