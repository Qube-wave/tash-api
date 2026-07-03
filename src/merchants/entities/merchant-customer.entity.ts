import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MerchantCustomerStatus {
  Active = 'active',
  Disabled = 'disabled',
}

@Entity({ name: 'merchant_customers' })
@Index(['merchantId', 'userId'], { unique: true })
export class MerchantCustomer {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'integer' })
  merchantId!: number;

  @Column({ type: 'integer' })
  userId!: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  merchantCustomerReference!: string | null;

  @Column({ type: 'enum', enum: MerchantCustomerStatus })
  status!: MerchantCustomerStatus;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
