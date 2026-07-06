import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserProfile } from './user-profile.entity';

export enum UserStatus {
  PendingRegistration = 'pending_registration',
  Active = 'active',
  Suspended = 'suspended',
  Disabled = 'disabled',
}

export enum UserType {
  Consumer = 'consumer',
  Merchant = 'merchant',
  Admin = 'admin',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid', generated: 'uuid' })
  uuid!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32, nullable: true })
  phoneNumber!: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32, nullable: true })
  paymentTag!: string | null;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status_enum',
    default: UserStatus.PendingRegistration,
  })
  status!: UserStatus;

  @Column({
    type: 'enum',
    enum: UserType,
    enumName: 'user_type_enum',
    array: true,
    default: [UserType.Consumer],
  })
  userTypes!: UserType[];

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  phoneVerifiedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => UserProfile, (profile) => profile.user)
  profile?: UserProfile;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeFields() {
    if (this.email) {
      this.email = this.email.trim().toLowerCase();
    }

    if (this.paymentTag) {
      this.paymentTag = this.paymentTag.trim().toLowerCase();
    }

    if (this.phoneNumber) {
      this.phoneNumber = this.phoneNumber.trim();
    }
  }
}
