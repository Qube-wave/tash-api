import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMerchantPayWithTashTables1735900005000 implements MigrationInterface {
  name = 'CreateMerchantPayWithTashTables1735900005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "merchants_verification_status_enum" AS ENUM ('unverified', 'pending', 'verified', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TYPE "merchants_status_enum" AS ENUM ('active', 'suspended', 'disabled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "merchant_api_keys_environment_enum" AS ENUM ('test', 'live')`,
    );
    await queryRunner.query(
      `CREATE TYPE "merchant_api_keys_status_enum" AS ENUM ('active', 'revoked', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TYPE "merchant_customers_status_enum" AS ENUM ('active', 'disabled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "merchant_webhook_deliveries_status_enum" AS ENUM ('pending', 'delivered', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "pay_with_tash_sessions_status_enum" AS ENUM ('created', 'requires_authentication', 'requires_payment_method', 'processing', 'successful', 'failed', 'cancelled', 'expired')`,
    );

    await queryRunner.query(`
      CREATE TABLE "merchants" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" integer NOT NULL,
        "businessName" varchar(160) NOT NULL,
        "displayName" varchar(120) NOT NULL,
        "merchantCode" varchar(40) NOT NULL,
        "email" varchar(255) NOT NULL,
        "phoneNumber" varchar(32) NOT NULL,
        "businessType" varchar(80) NOT NULL,
        "registrationNumber" varchar(80),
        "country" varchar(2) NOT NULL,
        "defaultCurrency" varchar(3) NOT NULL,
        "verificationStatus" "merchants_verification_status_enum" NOT NULL,
        "status" "merchants_status_enum" NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_merchants_uuid" UNIQUE ("uuid"),
        CONSTRAINT "UQ_merchants_merchantCode" UNIQUE ("merchantCode")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_merchants_ownerId" ON "merchants" ("ownerId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "merchant_settings" (
        "id" SERIAL PRIMARY KEY,
        "merchantId" integer NOT NULL,
        "webhookUrl" varchar(500),
        "webhookSecretHash" varchar(255),
        "callbackUrl" varchar(500),
        "allowedRedirectUrls" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "allowCardPayments" boolean NOT NULL DEFAULT true,
        "allowDirectDebitPayments" boolean NOT NULL DEFAULT true,
        "allowWalletPayments" boolean NOT NULL DEFAULT true,
        "checkoutName" varchar(120),
        "checkoutDescription" text,
        "checkoutLogoUrl" varchar(500),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_merchant_settings_merchantId" UNIQUE ("merchantId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "merchant_api_keys" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchantId" integer NOT NULL,
        "name" varchar(80) NOT NULL,
        "keyPrefix" varchar(24) NOT NULL,
        "secretHash" varchar(255) NOT NULL,
        "environment" "merchant_api_keys_environment_enum" NOT NULL,
        "status" "merchant_api_keys_status_enum" NOT NULL,
        "lastUsedAt" timestamptz,
        "expiresAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_merchant_api_keys_uuid" UNIQUE ("uuid")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_merchant_api_keys_merchantId" ON "merchant_api_keys" ("merchantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merchant_api_keys_keyPrefix" ON "merchant_api_keys" ("keyPrefix")`,
    );

    await queryRunner.query(`
      CREATE TABLE "merchant_customers" (
        "id" SERIAL PRIMARY KEY,
        "merchantId" integer NOT NULL,
        "userId" integer NOT NULL,
        "merchantCustomerReference" varchar(120),
        "status" "merchant_customers_status_enum" NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_merchant_customers_merchant_user" UNIQUE ("merchantId", "userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "merchant_webhook_deliveries" (
        "id" SERIAL PRIMARY KEY,
        "merchantId" integer NOT NULL,
        "eventId" varchar(80) NOT NULL,
        "eventType" varchar(120) NOT NULL,
        "url" varchar(500) NOT NULL,
        "payload" jsonb NOT NULL,
        "signature" text NOT NULL,
        "status" "merchant_webhook_deliveries_status_enum" NOT NULL,
        "responseStatus" integer,
        "responseBody" text,
        "attemptCount" integer NOT NULL DEFAULT 0,
        "nextRetryAt" timestamptz,
        "deliveredAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_merchant_webhook_deliveries_merchantId" ON "merchant_webhook_deliveries" ("merchantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merchant_webhook_deliveries_eventId" ON "merchant_webhook_deliveries" ("eventId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "pay_with_tash_sessions" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" varchar(80) NOT NULL,
        "merchantId" integer NOT NULL,
        "userId" integer,
        "transactionId" integer,
        "amount" bigint NOT NULL,
        "currency" varchar(3) NOT NULL,
        "description" text,
        "merchantReference" varchar(120) NOT NULL,
        "callbackUrl" varchar(500),
        "redirectUrl" varchar(500),
        "status" "pay_with_tash_sessions_status_enum" NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_pay_with_tash_sessions_uuid" UNIQUE ("uuid"),
        CONSTRAINT "UQ_pay_with_tash_sessions_reference" UNIQUE ("reference")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_pay_with_tash_sessions_merchantId" ON "pay_with_tash_sessions" ("merchantId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_pay_with_tash_sessions_merchantId"`,
    );
    await queryRunner.query(`DROP TABLE "pay_with_tash_sessions"`);
    await queryRunner.query(
      `DROP INDEX "IDX_merchant_webhook_deliveries_eventId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_merchant_webhook_deliveries_merchantId"`,
    );
    await queryRunner.query(`DROP TABLE "merchant_webhook_deliveries"`);
    await queryRunner.query(`DROP TABLE "merchant_customers"`);
    await queryRunner.query(`DROP INDEX "IDX_merchant_api_keys_keyPrefix"`);
    await queryRunner.query(`DROP INDEX "IDX_merchant_api_keys_merchantId"`);
    await queryRunner.query(`DROP TABLE "merchant_api_keys"`);
    await queryRunner.query(`DROP TABLE "merchant_settings"`);
    await queryRunner.query(`DROP INDEX "IDX_merchants_ownerId"`);
    await queryRunner.query(`DROP TABLE "merchants"`);
    await queryRunner.query(`DROP TYPE "pay_with_tash_sessions_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "merchant_webhook_deliveries_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "merchant_customers_status_enum"`);
    await queryRunner.query(`DROP TYPE "merchant_api_keys_status_enum"`);
    await queryRunner.query(`DROP TYPE "merchant_api_keys_environment_enum"`);
    await queryRunner.query(`DROP TYPE "merchants_status_enum"`);
    await queryRunner.query(`DROP TYPE "merchants_verification_status_enum"`);
  }
}
