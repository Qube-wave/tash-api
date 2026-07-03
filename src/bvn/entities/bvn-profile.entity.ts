import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BvnVerificationStatus {
  Pending = 'pending',
  Verified = 'verified',
  Failed = 'failed',
  Rejected = 'rejected',
}

@Entity({ name: 'bvn_profiles' })
export class BvnProfile {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'integer' })
  userId!: number;

  @Column({ type: 'text' })
  encryptedBvn!: string;

  @Column({ type: 'varchar', length: 16 })
  maskedBvn!: string;

  @Column({ type: 'varchar', length: 50 })
  provider!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerCustomerId!: string | null;

  @Column({ type: 'varchar', length: 120 })
  verificationReference!: string;

  @Column({ type: 'enum', enum: BvnVerificationStatus })
  verificationStatus!: BvnVerificationStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  verifiedFirstName!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  verifiedLastName!: string | null;

  @Column({ type: 'date', nullable: true })
  verifiedDateOfBirth!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  verifiedPhoneNumber!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
