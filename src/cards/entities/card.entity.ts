import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CardStatus {
  Pending = 'pending',
  Active = 'active',
  Expired = 'expired',
  Disabled = 'disabled',
  Revoked = 'revoked',
}

@Entity({ name: 'cards' })
export class Card {
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

  @Column({ type: 'varchar', length: 120 })
  providerCustomerId!: string;

  @Column({ type: 'text' })
  providerCardToken!: string;

  @Column({ type: 'varchar', length: 120 })
  authorizationReference!: string;

  @Column({ type: 'varchar', length: 40 })
  brand!: string;

  @Column({ type: 'varchar', length: 4 })
  lastFourDigits!: string;

  @Column({ type: 'varchar', length: 2 })
  expiryMonth!: string;

  @Column({ type: 'varchar', length: 4 })
  expiryYear!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  cardholderName!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bankName!: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ type: 'enum', enum: CardStatus, default: CardStatus.Pending })
  status!: CardStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastChargedAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
