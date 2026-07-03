import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum WalletStatus {
  Active = 'active',
  Restricted = 'restricted',
  Suspended = 'suspended',
  Closed = 'closed',
}

@Entity({ name: 'wallets' })
@Index(['userId', 'currency'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', generated: 'uuid' })
  uuid!: string;

  @Index()
  @Column({ type: 'integer' })
  userId!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'bigint', default: 0 })
  availableBalance!: string;

  @Column({ type: 'bigint', default: 0 })
  pendingBalance!: string;

  @Column({ type: 'bigint', default: 0 })
  ledgerBalance!: string;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.Active })
  status!: WalletStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
