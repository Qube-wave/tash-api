import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MerchantApiKeyEnvironment {
  Test = 'test',
  Live = 'live',
}

export enum MerchantApiKeyStatus {
  Active = 'active',
  Revoked = 'revoked',
  Expired = 'expired',
}

@Entity({ name: 'merchant_api_keys' })
export class MerchantApiKey {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', generated: 'uuid' })
  uuid!: string;

  @Index()
  @Column({ type: 'integer' })
  merchantId!: number;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Index()
  @Column({ type: 'varchar', length: 24 })
  keyPrefix!: string;

  @Column({ type: 'varchar', length: 255 })
  secretHash!: string;

  @Column({ type: 'enum', enum: MerchantApiKeyEnvironment })
  environment!: MerchantApiKeyEnvironment;

  @Column({ type: 'enum', enum: MerchantApiKeyStatus })
  status!: MerchantApiKeyStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
