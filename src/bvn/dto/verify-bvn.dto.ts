import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyBvnDto {
  @ApiProperty({
    description: 'Eleven-digit Bank Verification Number.',
    example: '22222222222',
    minLength: 11,
    maxLength: 11,
  })
  @IsString()
  @Length(11, 11)
  bvn!: string;

  @ApiProperty({
    description: 'First name to match against the BVN identity record.',
    example: 'Tash',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    description: 'Last name to match against the BVN identity record.',
    example: 'User',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    description: 'Date of birth to match against the BVN identity record.',
    example: '1990-01-31',
  })
  @IsDateString()
  dateOfBirth!: string;
}
