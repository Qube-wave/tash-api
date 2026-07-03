import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TransactionType {
  CardRegistration = 'card_registration',
  CardCharge = 'card_charge',
  CardWalletFunding = 'card_wallet_funding',
  DirectDebitRegistration = 'direct_debit_registration',
  DirectDebitCharge = 'direct_debit_charge',
  DirectDebitWalletFunding = 'direct_debit_wallet_funding',
  VirtualAccountFunding = 'virtual_account_funding',
  WalletTransfer = 'wallet_transfer',
  MerchantPayment = 'merchant_payment',
  Refund = 'refund',
  Reversal = 'reversal',
}

export enum TransactionDirection {
  Credit = 'credit',
  Debit = 'debit',
  Neutral = 'neutral',
}

export enum TransactionStatus {
  Created = 'created',
  Pending = 'pending',
  RequiresAction = 'requires_action',
  Processing = 'processing',
  Successful = 'successful',
  Failed = 'failed',
  Cancelled = 'cancelled',
  Reversed = 'reversed',
  PartiallyRefunded = 'partially_refunded',
  Refunded = 'refunded',
}

@Entity({ name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', generated: 'uuid' })
  uuid!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  reference!: string;

  @Index()
  @Column({ type: 'integer' })
  userId!: number;

  @Column({ type: 'integer', nullable: true })
  merchantId!: number | null;

  @Index()
  @Column({ type: 'integer', nullable: true })
  walletId!: number | null;

  @Column({ type: 'integer', nullable: true })
  cardId!: number | null;

  @Column({ type: 'integer', nullable: true })
  directDebitMandateId!: number | null;

  @Column({ type: 'integer', nullable: true })
  virtualAccountId!: number | null;

  @Column({ type: 'integer', nullable: true })
  payWithTashSessionId!: number | null;

  @Column({ type: 'integer', nullable: true })
  parentTransactionId!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerReference!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  externalReference!: string | null;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Column({ type: 'enum', enum: TransactionDirection })
  direction!: TransactionDirection;

  @Column({ type: 'bigint' })
  amount!: string;

  @Column({ type: 'bigint', default: 0 })
  fee!: string;

  @Column({ type: 'bigint' })
  netAmount!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'enum', enum: TransactionStatus })
  status!: TransactionStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  failureCode!: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  initiatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
