import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVirtualAccountWebhookTables1735900004000 implements MigrationInterface {
  name = 'CreateVirtualAccountWebhookTables1735900004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "virtual_accounts_type_enum" AS ENUM ('static', 'temporary')`,
    );
    await queryRunner.query(
      `CREATE TYPE "virtual_accounts_purpose_enum" AS ENUM ('wallet_funding', 'refund')`,
    );
    await queryRunner.query(
      `CREATE TYPE "virtual_accounts_status_enum" AS ENUM ('pending', 'active', 'expired', 'disabled', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "webhook_events_status_enum" AS ENUM ('received', 'processing', 'processed', 'failed')`,
    );

    await queryRunner.query(`
      CREATE TABLE "virtual_accounts" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" integer NOT NULL,
        "walletId" integer NOT NULL,
        "provider" varchar(50) NOT NULL,
        "providerCustomerId" varchar(120),
        "providerAccountId" varchar(120) NOT NULL,
        "accountName" varchar(160) NOT NULL,
        "accountNumber" varchar(20) NOT NULL,
        "bankName" varchar(120) NOT NULL,
        "bankCode" varchar(20),
        "currency" varchar(3) NOT NULL,
        "type" "virtual_accounts_type_enum" NOT NULL,
        "purpose" "virtual_accounts_purpose_enum" NOT NULL,
        "status" "virtual_accounts_status_enum" NOT NULL,
        "expiresAt" timestamptz,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_virtual_accounts_uuid" UNIQUE ("uuid")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_virtual_accounts_userId" ON "virtual_accounts" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_virtual_accounts_walletId" ON "virtual_accounts" ("walletId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_virtual_accounts_providerAccountId" ON "virtual_accounts" ("providerAccountId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_virtual_accounts_accountNumber" ON "virtual_accounts" ("accountNumber")`,
    );

    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id" SERIAL PRIMARY KEY,
        "provider" varchar(50) NOT NULL,
        "providerEventId" varchar(120) NOT NULL,
        "eventType" varchar(120) NOT NULL,
        "signature" text,
        "payload" jsonb NOT NULL,
        "status" "webhook_events_status_enum" NOT NULL,
        "processingAttempts" integer NOT NULL DEFAULT 0,
        "lastError" text,
        "processedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_webhook_events_provider_event" UNIQUE ("provider", "providerEventId")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "webhook_events"`);
    await queryRunner.query(`DROP INDEX "IDX_virtual_accounts_accountNumber"`);
    await queryRunner.query(
      `DROP INDEX "IDX_virtual_accounts_providerAccountId"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_virtual_accounts_walletId"`);
    await queryRunner.query(`DROP INDEX "IDX_virtual_accounts_userId"`);
    await queryRunner.query(`DROP TABLE "virtual_accounts"`);
    await queryRunner.query(`DROP TYPE "webhook_events_status_enum"`);
    await queryRunner.query(`DROP TYPE "virtual_accounts_status_enum"`);
    await queryRunner.query(`DROP TYPE "virtual_accounts_purpose_enum"`);
    await queryRunner.query(`DROP TYPE "virtual_accounts_type_enum"`);
  }
}
