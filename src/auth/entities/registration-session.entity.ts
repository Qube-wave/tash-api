import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum RegistrationStep {
  Profile = 'profile',
  ClaimTag = 'claim_tag',
  Pin = 'pin',
  Complete = 'complete',
}

@Entity({ name: 'registration_sessions' })
export class RegistrationSession {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  tokenId!: string;

  @Column({ type: 'varchar', length: 255 })
  tokenHash!: string;

  @Index()
  @Column({ type: 'integer' })
  userId!: number;

  @Column({
    type: 'enum',
    enum: RegistrationStep,
    default: RegistrationStep.Profile,
  })
  currentStep!: RegistrationStep;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
