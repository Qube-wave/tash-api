import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MerchantVerificationStatus {
  Unverified = 'unverified',
  Pending = 'pending',
  Verified = 'verified',
  Rejected = 'rejected',
}

export enum MerchantStatus {
  Active = 'active',
  Suspended = 'suspended',
  Disabled = 'disabled',
}

@Entity({ name: 'merchants' })
export class Merchant {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', generated: 'uuid' })
  uuid!: string;

  @Index()
  @Column({ type: 'integer' })
  ownerId!: number;

  @Column({ type: 'varchar', length: 160 })
  businessName!: string;

  @Column({ type: 'varchar', length: 120 })
  displayName!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  merchantCode!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 32 })
  phoneNumber!: string;

  @Column({ type: 'varchar', length: 80 })
  businessType!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  registrationNumber!: string | null;

  @Column({ type: 'varchar', length: 2 })
  country!: string;

  @Column({ type: 'varchar', length: 3 })
  defaultCurrency!: string;

  @Column({ type: 'enum', enum: MerchantVerificationStatus })
  verificationStatus!: MerchantVerificationStatus;

  @Column({ type: 'enum', enum: MerchantStatus })
  status!: MerchantStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
