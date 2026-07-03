import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'merchant_settings' })
export class MerchantSettings {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'integer' })
  merchantId!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  webhookUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  webhookSecretHash!: string | null;

  @Column({ type: 'text', nullable: true })
  webhookSecretCiphertext!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  callbackUrl!: string | null;

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  allowedRedirectUrls!: string[];

  @Column({ type: 'boolean', default: true })
  allowCardPayments!: boolean;

  @Column({ type: 'boolean', default: true })
  allowDirectDebitPayments!: boolean;

  @Column({ type: 'boolean', default: true })
  allowWalletPayments!: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  checkoutName!: string | null;

  @Column({ type: 'text', nullable: true })
  checkoutDescription!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  checkoutLogoUrl!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
