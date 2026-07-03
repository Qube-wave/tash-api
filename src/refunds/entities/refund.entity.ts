import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RefundDestinationType {
  Wallet = 'wallet',
  OriginalPaymentMethod = 'original_payment_method',
  VirtualAccount = 'virtual_account',
}

export enum RefundStatus {
  Pending = 'pending',
  Processing = 'processing',
  Successful = 'successful',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

@Entity({ name: 'refunds' })
export class Refund {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', generated: 'uuid' })
  uuid!: string;

  @Index()
  @Column({ type: 'integer' })
  transactionId!: number;

  @Column({ type: 'integer', nullable: true })
  parentRefundId!: number | null;

  @Index()
  @Column({ type: 'integer' })
  userId!: number;

  @Index()
  @Column({ type: 'integer', nullable: true })
  merchantId!: number | null;

  @Column({ type: 'integer', nullable: true })
  walletId!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerReference!: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  reference!: string;

  @Column({ type: 'bigint' })
  amount!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'enum', enum: RefundDestinationType })
  destinationType!: RefundDestinationType;

  @Column({ type: 'varchar', length: 160, nullable: true })
  destinationReference!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'enum', enum: RefundStatus })
  status!: RefundStatus;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
