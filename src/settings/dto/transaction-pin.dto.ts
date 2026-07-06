import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateTransactionPinDto {
  @ApiProperty({
    name: 'pin',
    type: 'string',
  })
  @IsString()
  @Length(4, 4)
  pin!: string;
}

export class UpdateTransactionPinDto {
  @ApiProperty({
    name: 'currentPin',
    type: 'string',
  })
  @IsString()
  @Length(4, 4)
  currentPin!: string;

  @ApiProperty({
    name: 'newPin',
    type: 'string',
  })
  @IsString()
  @Length(4, 4)
  newPin!: string;
}
