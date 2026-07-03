import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'user_payment_settings' })
export class UserPaymentSettings {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'integer' })
  userId!: number;

  @Column({ type: 'integer', nullable: true })
  defaultCardId!: number | null;

  @Column({ type: 'integer', nullable: true })
  defaultDirectDebitMandateId!: number | null;

  @Column({ type: 'integer', nullable: true })
  defaultWalletId!: number | null;

  @Column({ type: 'boolean', default: true })
  requireTransactionPin!: boolean;

  @Column({ type: 'boolean', default: true })
  allowCardPayments!: boolean;

  @Column({ type: 'boolean', default: true })
  allowDirectDebitPayments!: boolean;

  @Column({ type: 'boolean', default: true })
  allowWalletPayments!: boolean;

  @Column({ type: 'boolean', default: true })
  allowMerchantPayments!: boolean;

  @Column({ type: 'bigint', default: 50000000 })
  dailyTransferLimit!: string;

  @Column({ type: 'bigint', default: 50000000 })
  dailyPaymentLimit!: string;

  @Column({ type: 'bigint', default: 10000000 })
  singleTransactionLimit!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  notificationPreferences!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
