import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MerchantWebhookDeliveryStatus {
  Pending = 'pending',
  Delivered = 'delivered',
  Failed = 'failed',
}

@Entity({ name: 'merchant_webhook_deliveries' })
export class MerchantWebhookDelivery {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index()
  @Column({ type: 'integer' })
  merchantId!: number;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  eventId!: string;

  @Column({ type: 'varchar', length: 120 })
  eventType!: string;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'text' })
  signature!: string;

  @Column({ type: 'enum', enum: MerchantWebhookDeliveryStatus })
  status!: MerchantWebhookDeliveryStatus;

  @Column({ type: 'integer', nullable: true })
  responseStatus!: number | null;

  @Column({ type: 'text', nullable: true })
  responseBody!: string | null;

  @Column({ type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
