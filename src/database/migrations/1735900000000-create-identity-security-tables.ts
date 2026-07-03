import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdentitySecurityTables1735900000000 implements MigrationInterface {
  name = 'CreateIdentitySecurityTables1735900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "users_status_enum" AS ENUM ('pending_verification', 'active', 'suspended', 'disabled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "verification_tokens_type_enum" AS ENUM ('email', 'phone', 'password_reset')`,
    );
    await queryRunner.query(
      `CREATE TYPE "bvn_profiles_verification_status_enum" AS ENUM ('pending', 'verified', 'failed', 'rejected')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL,
        "phoneNumber" varchar(32) NOT NULL,
        "paymentTag" varchar(32) NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        "status" "users_status_enum" NOT NULL DEFAULT 'pending_verification',
        "userTypes" text[] NOT NULL DEFAULT ARRAY['consumer']::text[],
        "emailVerifiedAt" timestamptz,
        "phoneVerifiedAt" timestamptz,
        "lastLoginAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_uuid" UNIQUE ("uuid"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_phoneNumber" UNIQUE ("phoneNumber"),
        CONSTRAINT "UQ_users_paymentTag" UNIQUE ("paymentTag")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        "dateOfBirth" date NOT NULL,
        "country" varchar(2) NOT NULL DEFAULT 'NG',
        "defaultCurrency" varchar(3) NOT NULL DEFAULT 'NGN',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_user_profiles_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" SERIAL PRIMARY KEY,
        "tokenId" uuid NOT NULL,
        "userId" integer NOT NULL,
        "tokenHash" varchar(255) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "revokedAt" timestamptz,
        "replacedByTokenId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refresh_tokens_tokenId" UNIQUE ("tokenId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_userId" ON "refresh_tokens" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "verification_tokens" (
        "id" SERIAL PRIMARY KEY,
        "tokenId" uuid NOT NULL,
        "userId" integer NOT NULL,
        "type" "verification_tokens_type_enum" NOT NULL,
        "tokenHash" varchar(255) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "consumedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_verification_tokens_tokenId" UNIQUE ("tokenId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_verification_tokens_userId" ON "verification_tokens" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "user_payment_settings" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "defaultCardId" integer,
        "defaultDirectDebitMandateId" integer,
        "defaultWalletId" integer,
        "requireTransactionPin" boolean NOT NULL DEFAULT true,
        "allowCardPayments" boolean NOT NULL DEFAULT true,
        "allowDirectDebitPayments" boolean NOT NULL DEFAULT true,
        "allowWalletPayments" boolean NOT NULL DEFAULT true,
        "allowMerchantPayments" boolean NOT NULL DEFAULT true,
        "dailyTransferLimit" bigint NOT NULL DEFAULT 50000000,
        "dailyPaymentLimit" bigint NOT NULL DEFAULT 50000000,
        "singleTransactionLimit" bigint NOT NULL DEFAULT 10000000,
        "notificationPreferences" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_payment_settings_userId" UNIQUE ("userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transaction_pins" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "pinHash" varchar(255) NOT NULL,
        "failedAttempts" integer NOT NULL DEFAULT 0,
        "lockedUntil" timestamptz,
        "lastChangedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_transaction_pins_userId" UNIQUE ("userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "bvn_profiles" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "encryptedBvn" text NOT NULL,
        "maskedBvn" varchar(16) NOT NULL,
        "provider" varchar(50) NOT NULL,
        "providerCustomerId" varchar(120),
        "verificationReference" varchar(120) NOT NULL,
        "verificationStatus" "bvn_profiles_verification_status_enum" NOT NULL,
        "verifiedFirstName" varchar(100),
        "verifiedLastName" varchar(100),
        "verifiedDateOfBirth" date,
        "verifiedPhoneNumber" varchar(32),
        "verifiedAt" timestamptz,
        "failureReason" text,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_bvn_profiles_userId" UNIQUE ("userId")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bvn_profiles"`);
    await queryRunner.query(`DROP TABLE "transaction_pins"`);
    await queryRunner.query(`DROP TABLE "user_payment_settings"`);
    await queryRunner.query(`DROP INDEX "IDX_verification_tokens_userId"`);
    await queryRunner.query(`DROP TABLE "verification_tokens"`);
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_userId"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "user_profiles"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP TYPE "bvn_profiles_verification_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "verification_tokens_type_enum"`);
    await queryRunner.query(`DROP TYPE "users_status_enum"`);
  }
}
