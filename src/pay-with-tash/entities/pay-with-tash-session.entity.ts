import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PayWithTashSessionStatus {
  Created = 'created',
  RequiresAuthentication = 'requires_authentication',
  RequiresPaymentMethod = 'requires_payment_method',
  Processing = 'processing',
  Successful = 'successful',
  Failed = 'failed',
  Cancelled = 'cancelled',
  Expired = 'expired',
}

@Entity({ name: 'pay_with_tash_sessions' })
export class PayWithTashSession {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', generated: 'uuid' })
  uuid!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  reference!: string;

  @Index()
  @Column({ type: 'integer' })
  merchantId!: number;

  @Column({ type: 'integer', nullable: true })
  userId!: number | null;

  @Column({ type: 'integer', nullable: true })
  transactionId!: number | null;

  @Column({ type: 'bigint' })
  amount!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 120 })
  merchantReference!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  callbackUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  redirectUrl!: string | null;

  @Column({ type: 'enum', enum: PayWithTashSessionStatus })
  status!: PayWithTashSessionStatus;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
