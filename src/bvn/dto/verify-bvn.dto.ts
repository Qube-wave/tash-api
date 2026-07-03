import {
  IsDateString,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyBvnDto {
  @IsString()
  @Length(11, 11)
  bvn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;
}
