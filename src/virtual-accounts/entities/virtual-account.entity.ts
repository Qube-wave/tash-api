import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum VirtualAccountType {
  Static = 'static',
  Temporary = 'temporary',
}

export enum VirtualAccountPurpose {
  WalletFunding = 'wallet_funding',
  Refund = 'refund',
}

export enum VirtualAccountStatus {
  Pending = 'pending',
  Active = 'active',
  Expired = 'expired',
  Disabled = 'disabled',
  Failed = 'failed',
}

@Entity({ name: 'virtual_accounts' })
export class VirtualAccount {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', generated: 'uuid' })
  uuid!: string;

  @Index()
  @Column({ type: 'integer' })
  userId!: number;

  @Index()
  @Column({ type: 'integer' })
  walletId!: number;

  @Column({ type: 'varchar', length: 50 })
  provider!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerCustomerId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 120 })
  providerAccountId!: string;

  @Column({ type: 'varchar', length: 160 })
  accountName!: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  accountNumber!: string;

  @Column({ type: 'varchar', length: 120 })
  bankName!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  bankCode!: string | null;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'enum', enum: VirtualAccountType })
  type!: VirtualAccountType;

  @Column({ type: 'enum', enum: VirtualAccountPurpose })
  purpose!: VirtualAccountPurpose;

  @Column({ type: 'enum', enum: VirtualAccountStatus })
  status!: VirtualAccountStatus;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
