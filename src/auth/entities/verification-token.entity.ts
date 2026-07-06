import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum VerificationTokenType {
  Email = 'email',
  Phone = 'phone',
  PasswordReset = 'password_reset',
}

@Entity({ name: 'verification_tokens' })
export class VerificationToken {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  tokenId!: string;

  @Index()
  @Column({ type: 'integer', nullable: true })
  userId?: number | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  phoneNumber?: string | null;

  @Column({ type: 'enum', enum: VerificationTokenType })
  type!: VerificationTokenType;

  @Column({ type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'integer' })
  maxAttempts!: number;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
