import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DirectDebitMandateStatus {
  Pending = 'pending',
  RequiresAuthorization = 'requires_authorization',
  Active = 'active',
  Failed = 'failed',
  Expired = 'expired',
  Revoked = 'revoked',
}

@Entity({ name: 'direct_debit_mandates' })
export class DirectDebitMandate {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', generated: 'uuid' })
  uuid!: string;

  @Index()
  @Column({ type: 'integer' })
  userId!: number;

  @Column({ type: 'varchar', length: 50 })
  provider!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerCustomerId!: string | null;

  @Column({ type: 'varchar', length: 120 })
  providerMandateId!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  authorizationReference!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bankName!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  accountName!: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  accountNumberLastFour!: string | null;

  @Column({ type: 'varchar', length: 20 })
  bankCode!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'bigint' })
  maximumAmount!: string;

  @Column({ type: 'enum', enum: DirectDebitMandateStatus })
  status!: DirectDebitMandateStatus;

  @Column({ type: 'timestamptz', nullable: true })
  authorizedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
