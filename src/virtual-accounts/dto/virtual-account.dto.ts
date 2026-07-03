import { IsEnum, IsUUID } from 'class-validator';
import {
  VirtualAccountPurpose,
  VirtualAccountType,
} from '../entities/virtual-account.entity';

export class CreateVirtualAccountDto {
  @IsUUID()
  walletUuid!: string;

  @IsEnum(VirtualAccountType)
  type!: VirtualAccountType;

  @IsEnum(VirtualAccountPurpose)
  purpose!: VirtualAccountPurpose;
}
