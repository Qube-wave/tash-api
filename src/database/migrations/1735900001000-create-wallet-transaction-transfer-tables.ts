import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletTransactionTransferTables1735900001000 implements MigrationInterface {
  name = 'CreateWalletTransactionTransferTables1735900001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "wallets_status_enum" AS ENUM ('active', 'restricted', 'suspended', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "wallet_ledger_entries_direction_enum" AS ENUM ('credit', 'debit')`,
    );
    await queryRunner.query(
      `CREATE TYPE "wallet_ledger_entries_entry_type_enum" AS ENUM ('card_funding', 'direct_debit_funding', 'virtual_account_funding', 'transfer_sent', 'transfer_received', 'merchant_payment', 'refund_received', 'refund_debit', 'reversal', 'adjustment')`,
    );
    await queryRunner.query(
      `CREATE TYPE "wallet_ledger_entries_status_enum" AS ENUM ('pending', 'completed', 'reversed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transactions_type_enum" AS ENUM ('card_registration', 'card_charge', 'card_wallet_funding', 'direct_debit_registration', 'direct_debit_charge', 'direct_debit_wallet_funding', 'virtual_account_funding', 'wallet_transfer', 'merchant_payment', 'refund', 'reversal')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transactions_direction_enum" AS ENUM ('credit', 'debit', 'neutral')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transactions_status_enum" AS ENUM ('created', 'pending', 'requires_action', 'processing', 'successful', 'failed', 'cancelled', 'reversed', 'partially_refunded', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TYPE "idempotency_records_status_enum" AS ENUM ('processing', 'completed', 'failed')`,
    );

    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" integer NOT NULL,
        "currency" varchar(3) NOT NULL,
        "availableBalance" bigint NOT NULL DEFAULT 0,
        "pendingBalance" bigint NOT NULL DEFAULT 0,
        "ledgerBalance" bigint NOT NULL DEFAULT 0,
        "status" "wallets_status_enum" NOT NULL DEFAULT 'active',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_wallets_uuid" UNIQUE ("uuid"),
        CONSTRAINT "UQ_wallets_user_currency" UNIQUE ("userId", "currency")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_wallets_userId" ON "wallets" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" varchar(64) NOT NULL,
        "userId" integer NOT NULL,
        "merchantId" integer,
        "walletId" integer,
        "cardId" integer,
        "directDebitMandateId" integer,
        "virtualAccountId" integer,
        "payWithTashSessionId" integer,
        "parentTransactionId" integer,
        "provider" varchar(50),
        "providerReference" varchar(120),
        "externalReference" varchar(120),
        "type" "transactions_type_enum" NOT NULL,
        "direction" "transactions_direction_enum" NOT NULL,
        "amount" bigint NOT NULL,
        "fee" bigint NOT NULL DEFAULT 0,
        "netAmount" bigint NOT NULL,
        "currency" varchar(3) NOT NULL,
        "status" "transactions_status_enum" NOT NULL,
        "failureCode" varchar(80),
        "failureReason" text,
        "description" text,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "initiatedAt" timestamptz NOT NULL,
        "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_transactions_uuid" UNIQUE ("uuid"),
        CONSTRAINT "UQ_transactions_reference" UNIQUE ("reference")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_userId" ON "transactions" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_walletId" ON "transactions" ("walletId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "wallet_ledger_entries" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "walletId" integer NOT NULL,
        "transactionId" integer NOT NULL,
        "reference" varchar(80) NOT NULL,
        "direction" "wallet_ledger_entries_direction_enum" NOT NULL,
        "entryType" "wallet_ledger_entries_entry_type_enum" NOT NULL,
        "amount" bigint NOT NULL,
        "currency" varchar(3) NOT NULL,
        "balanceBefore" bigint NOT NULL,
        "balanceAfter" bigint NOT NULL,
        "status" "wallet_ledger_entries_status_enum" NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_wallet_ledger_entries_uuid" UNIQUE ("uuid")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_ledger_entries_walletId" ON "wallet_ledger_entries" ("walletId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_ledger_entries_transactionId" ON "wallet_ledger_entries" ("transactionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_ledger_entries_reference" ON "wallet_ledger_entries" ("reference")`,
    );

    await queryRunner.query(`
      CREATE TABLE "idempotency_records" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer,
        "merchantId" integer,
        "route" varchar(180) NOT NULL,
        "idempotencyKey" varchar(120) NOT NULL,
        "requestHash" varchar(64) NOT NULL,
        "responseStatus" integer,
        "responseBody" jsonb,
        "status" "idempotency_records_status_enum" NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_idempotency_records_user_route_key" UNIQUE ("userId", "route", "idempotencyKey"),
        CONSTRAINT "UQ_idempotency_records_merchant_route_key" UNIQUE ("merchantId", "route", "idempotencyKey")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_idempotency_records_userId" ON "idempotency_records" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_idempotency_records_merchantId" ON "idempotency_records" ("merchantId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_idempotency_records_merchantId"`);
    await queryRunner.query(`DROP INDEX "IDX_idempotency_records_userId"`);
    await queryRunner.query(`DROP TABLE "idempotency_records"`);
    await queryRunner.query(`DROP INDEX "IDX_wallet_ledger_entries_reference"`);
    await queryRunner.query(
      `DROP INDEX "IDX_wallet_ledger_entries_transactionId"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_wallet_ledger_entries_walletId"`);
    await queryRunner.query(`DROP TABLE "wallet_ledger_entries"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_walletId"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_userId"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP INDEX "IDX_wallets_userId"`);
    await queryRunner.query(`DROP TABLE "wallets"`);
    await queryRunner.query(`DROP TYPE "idempotency_records_status_enum"`);
    await queryRunner.query(`DROP TYPE "transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE "transactions_direction_enum"`);
    await queryRunner.query(`DROP TYPE "transactions_type_enum"`);
    await queryRunner.query(`DROP TYPE "wallet_ledger_entries_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "wallet_ledger_entries_entry_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "wallet_ledger_entries_direction_enum"`);
    await queryRunner.query(`DROP TYPE "wallets_status_enum"`);
  }
}
