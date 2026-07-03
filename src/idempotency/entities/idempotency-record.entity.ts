import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum IdempotencyRecordStatus {
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

@Entity({ name: 'idempotency_records' })
@Index(['userId', 'route', 'idempotencyKey'], { unique: true })
export class IdempotencyRecord {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'integer', nullable: true })
  userId!: number | null;

  @Column({ type: 'integer', nullable: true })
  merchantId!: number | null;

  @Column({ type: 'varchar', length: 180 })
  route!: string;

  @Column({ type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ type: 'integer', nullable: true })
  responseStatus!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  responseBody!: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: IdempotencyRecordStatus })
  status!: IdempotencyRecordStatus;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
