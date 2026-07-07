import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CardRegistrationSessionStatus {
  Created = 'created',
  Pending = 'pending',
  Verified = 'verified',
  Completed = 'completed',
  Failed = 'failed',
  Expired = 'expired',
}

@Entity({ name: 'card_registration_sessions' })
export class CardRegistrationSession {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  reference!: string;

  @Index()
  @Column({ type: 'integer' })
  userId!: number;

  @Column({ type: 'varchar', length: 50 })
  provider!: string;

  @Column({ type: 'text', nullable: true })
  authorizationUrl!: string | null;

  @Column({ type: 'enum', enum: CardRegistrationSessionStatus })
  status!: CardRegistrationSessionStatus;

  @Column({ type: 'integer', nullable: true })
  cardId!: number | null;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
