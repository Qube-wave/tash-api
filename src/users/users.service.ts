import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from './entities/user-profile.entity';
import { User, UserStatus, UserType } from './entities/user.entity';
import {
  assertValidPaymentTag,
  normalizePaymentTag,
} from './utils/payment-tag.util';

export interface PublicUserProfile {
  uuid: string;
  email: string | null;
  phoneNumber: string | null;
  paymentTag: string | null;
  status: UserStatus;
  userTypes: UserType[];
  profile: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    country: string;
    defaultCurrency: string;
  } | null;
}

export interface ResolvedRecipient {
  uuid: string;
  paymentTag: string;
  firstName: string;
  lastName: string;
}

export interface CompleteRegistrationProfileInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

export interface RegistrationProgress {
  user: User;
  hasProfile: boolean;
  hasPaymentTag: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profilesRepository: Repository<UserProfile>,
  ) {}

  async createUserWithPhoneNumber(phoneNumber: string) {
    await this.ensureUniqueIdentity({ phoneNumber });

    const now = new Date();

    const user = this.usersRepository.create({
      status: UserStatus.PendingRegistration,
      phoneNumber,
      phoneVerifiedAt: now,
      userTypes: [UserType.Consumer],
      emailVerifiedAt: null,
      lastLoginAt: null,
    });

    const savedUser = await this.usersRepository.save(user);

    return savedUser;
  }

  async createUserWithEmail(email: string) {
    await this.ensureUniqueIdentity({ email });

    const now = new Date();

    const user = this.usersRepository.create({
      status: UserStatus.PendingRegistration,
      email,
      phoneVerifiedAt: null,
      userTypes: [UserType.Consumer],
      emailVerifiedAt: now,
      lastLoginAt: null,
    });

    const savedUser = await this.usersRepository.save(user);

    return savedUser;
  }

  async findByUuid(uuid: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { uuid } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async findByPhone(phoneNumber: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: {
        phoneNumber,
      },
    });
  }

  async getRegistrationProgress(userId: number): Promise<RegistrationProgress> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { profile: true },
    });

    if (user === null) {
      throw new NotFoundException('User was not found.');
    }

    return {
      user,
      hasProfile: user.profile != null,
      hasPaymentTag: user.paymentTag != null,
    };
  }

  async markRegistrationPhoneVerified(user: User): Promise<User> {
    if (user.status !== UserStatus.PendingRegistration) {
      throw new ConflictException('Registration cannot be resumed.');
    }

    user.phoneVerifiedAt = new Date();
    return this.usersRepository.save(user);
  }

  async markRegistrationEmailVerified(user: User): Promise<User> {
    if (user.status !== UserStatus.PendingRegistration) {
      throw new ConflictException('Registration cannot be resumed.');
    }

    user.emailVerifiedAt = new Date();
    return this.usersRepository.save(user);
  }

  async getByUuid(uuid: string): Promise<User> {
    const user = await this.findByUuid(uuid);

    if (user === null) {
      throw new NotFoundException('User was not found.');
    }

    return user;
  }

  async getPublicProfile(uuid: string): Promise<PublicUserProfile> {
    const user = await this.usersRepository.findOne({
      where: { uuid },
      relations: { profile: true },
    });

    if (user === null) {
      throw new NotFoundException('User was not found.');
    }

    return this.toPublicProfile(user);
  }

  async completeRegistrationProfile(
    userId: number,
    input: CompleteRegistrationProfileInput,
  ): Promise<PublicUserProfile> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { profile: true },
    });

    if (user === null) {
      throw new NotFoundException('User was not found.');
    }

    if (user.status !== UserStatus.PendingRegistration) {
      throw new ConflictException('Registration profile cannot be changed.');
    }

    const profile =
      user.profile ??
      this.profilesRepository.create({
        userId: user.id,
        country: 'NG',
        defaultCurrency: 'NGN',
      });

    profile.firstName = input.firstName.trim();
    profile.lastName = input.lastName.trim();
    profile.dateOfBirth = input.dateOfBirth;

    await this.profilesRepository.save(profile);
    return this.getPublicProfile(user.uuid);
  }

  async completeRegistrationPaymentTag(
    userId: number,
    paymentTag: string,
  ): Promise<PublicUserProfile> {
    const tag = assertValidPaymentTag(paymentTag);
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (user === null) {
      throw new NotFoundException('User was not found.');
    }

    if (user.status !== UserStatus.PendingRegistration) {
      throw new ConflictException('Registration tag cannot be changed.');
    }

    if (user.paymentTag === tag) {
      return this.getPublicProfile(user.uuid);
    }

    const existing = await this.usersRepository.findOne({
      where: { paymentTag: tag },
    });
    if (existing !== null && existing.id !== user.id) {
      throw new ConflictException('Payment tag is already in use.');
    }

    user.paymentTag = tag;
    await this.usersRepository.save(user);
    return this.getPublicProfile(user.uuid);
  }

  async completeRegistration(userId: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { profile: true },
    });

    if (user === null) {
      throw new NotFoundException('User was not found.');
    }

    if (user.status !== UserStatus.PendingRegistration) {
      throw new ConflictException('Registration is already complete.');
    }

    if (user.profile == null) {
      throw new ConflictException('Registration profile is required.');
    }

    if (user.paymentTag === null) {
      throw new ConflictException('Payment tag is required.');
    }

    user.status = UserStatus.Active;
    return this.usersRepository.save(user);
  }

  async updatePaymentTag(
    uuid: string,
    paymentTag: string,
  ): Promise<PublicUserProfile> {
    const tag = assertValidPaymentTag(paymentTag);
    const user = await this.getByUuid(uuid);

    if (user.status !== UserStatus.Active) {
      throw new ConflictException('Only active users can change payment tag.');
    }

    if (user.paymentTag === tag) {
      return this.getPublicProfile(uuid);
    }

    const existing = await this.usersRepository.findOne({
      where: { paymentTag: tag },
    });
    if (existing !== null) {
      throw new ConflictException('Payment tag is already in use.');
    }

    user.paymentTag = tag;
    await this.usersRepository.save(user);
    return this.getPublicProfile(uuid);
  }

  async resolveRecipient(recipient: string): Promise<ResolvedRecipient> {
    const tag = normalizePaymentTag(recipient);

    const user = await this.usersRepository.findOne({
      where: { paymentTag: tag },
      relations: { profile: true },
    });

    if (
      user === null ||
      user.profile === undefined ||
      user.status !== UserStatus.Active ||
      user.paymentTag === null
    ) {
      throw new NotFoundException('Recipient was not found.');
    }

    return {
      uuid: user.uuid,
      paymentTag: user.paymentTag,
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
    };
  }

  async markLogin(user: User): Promise<void> {
    user.lastLoginAt = new Date();
    await this.usersRepository.save(user);
  }

  async updateEmail(userId: number, email: string): Promise<PublicUserProfile> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (user === null) {
      throw new NotFoundException('User was not found.');
    }

    const existing = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existing !== null && existing.id !== user.id) {
      throw new ConflictException('A user with this email already exists.');
    }

    user.email = normalizedEmail;
    user.emailVerifiedAt = new Date();
    await this.usersRepository.save(user);

    return this.getPublicProfile(user.uuid);
  }

  private async ensureUniqueIdentity({
    email,
    phoneNumber,
    paymentTag,
  }: {
    email?: string;
    phoneNumber?: string;
    paymentTag?: string;
  }): Promise<void> {
    const whereCriteria = [];
    let errorFields = '';

    if (email !== undefined) {
      whereCriteria.push({ email });
      errorFields += 'email,';
    }

    if (phoneNumber !== undefined) {
      whereCriteria.push({ phoneNumber });
      errorFields += 'phone number,';
    }

    if (paymentTag !== undefined) {
      whereCriteria.push({ paymentTag });
      errorFields += 'payment tag';
    }

    const existing = await this.usersRepository.findOne({
      where: whereCriteria,
    });

    if (existing !== null) {
      throw new ConflictException(
        `A user with this ${errorFields} already exists.`,
      );
    }
  }

  private toPublicProfile(user: User): PublicUserProfile {
    return {
      uuid: user.uuid,
      email: user.email,
      phoneNumber: user.phoneNumber,
      paymentTag: user.paymentTag,
      status: user.status,
      userTypes: user.userTypes,
      profile:
        user.profile === undefined
          ? null
          : {
              firstName: user.profile.firstName,
              lastName: user.profile.lastName,
              dateOfBirth: user.profile.dateOfBirth,
              country: user.profile.country,
              defaultCurrency: user.profile.defaultCurrency,
            },
    };
  }
}
