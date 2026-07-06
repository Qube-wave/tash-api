import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfile } from './entities/user-profile.entity';
import { User, UserStatus, UserType } from './entities/user.entity';
import {
  assertValidPaymentTag,
  normalizePaymentTag,
} from './utils/payment-tag.util';

export interface PublicUserProfile {
  uuid: string;
  email: string;
  phoneNumber: string;
  paymentTag: string;
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

  async createUser(input: CreateUserInput): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const phoneNumber = input.phoneNumber.trim();
    const paymentTag = assertValidPaymentTag(input.paymentTag);

    await this.ensureUniqueIdentity({ email, phoneNumber, paymentTag });

    const user = this.usersRepository.create({
      email,
      phoneNumber,
      paymentTag,
      passwordHash: input.passwordHash,
      status: UserStatus.PendingVerification,
      userTypes: [UserType.Consumer],
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      lastLoginAt: null,
    });

    const savedUser = await this.usersRepository.save(user);

    const profile = this.profilesRepository.create({
      userId: savedUser.id,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth,
      country: input.country.toUpperCase(),
      defaultCurrency: input.defaultCurrency.toUpperCase(),
    });
    await this.profilesRepository.save(profile);

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

  async updateProfile(
    uuid: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUserProfile> {
    const user = await this.usersRepository.findOne({
      where: { uuid },
      relations: { profile: true },
    });

    if (user === null) {
      throw new NotFoundException('User was not found.');
    }

    const profile = user.profile;
    if (profile === undefined) {
      throw new NotFoundException('User profile was not found.');
    }

    if (dto.firstName !== undefined) profile.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) profile.lastName = dto.lastName.trim();
    if (dto.dateOfBirth !== undefined) profile.dateOfBirth = dto.dateOfBirth;
    if (dto.country !== undefined) profile.country = dto.country.toUpperCase();
    if (dto.defaultCurrency !== undefined) {
      profile.defaultCurrency = dto.defaultCurrency.toUpperCase();
    }

    await this.profilesRepository.save(profile);
    return this.getPublicProfile(uuid);
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
    const normalized = recipient.trim();
    const tag = normalizePaymentTag(normalized);
    const where: FindOptionsWhere<User>[] = [
      { paymentTag: tag },
      { email: normalized.toLowerCase() },
      { phoneNumber: normalized },
    ];

    const user = await this.usersRepository.findOne({
      where,
      relations: { profile: true },
    });

    if (user === null || user.profile === undefined) {
      throw new NotFoundException('Recipient was not found.');
    }

    return {
      uuid: user.uuid,
      paymentTag: user.paymentTag ?? '',
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
    };
  }

  async markLogin(user: User): Promise<void> {
    user.lastLoginAt = new Date();
    await this.usersRepository.save(user);
  }

  async activateIfVerified(user: User): Promise<User> {
    if (user.emailVerifiedAt !== null && user.phoneVerifiedAt !== null) {
      user.status = UserStatus.Active;
      return this.usersRepository.save(user);
    }

    return user;
  }

  async markEmailVerified(user: User): Promise<User> {
    user.emailVerifiedAt = new Date();
    return this.activateIfVerified(user);
  }

  async markPhoneVerified(user: User): Promise<User> {
    user.phoneVerifiedAt = new Date();
    return this.activateIfVerified(user);
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
      email: user.email ?? '',
      phoneNumber: user.phoneNumber ?? '',
      paymentTag: user.paymentTag ?? '',
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
