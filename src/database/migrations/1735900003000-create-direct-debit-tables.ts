import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDirectDebitTables1735900003000 implements MigrationInterface {
  name = 'CreateDirectDebitTables1735900003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "direct_debit_mandates_status_enum" AS ENUM ('pending', 'requires_authorization', 'active', 'failed', 'expired', 'revoked')`,
    );

    await queryRunner.query(`
      CREATE TABLE "direct_debit_mandates" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" integer NOT NULL,
        "provider" varchar(50) NOT NULL,
        "providerCustomerId" varchar(120),
        "providerMandateId" varchar(120) NOT NULL,
        "authorizationReference" varchar(120),
        "bankName" varchar(120),
        "accountName" varchar(120),
        "accountNumberLastFour" varchar(4),
        "bankCode" varchar(20) NOT NULL,
        "currency" varchar(3) NOT NULL,
        "maximumAmount" bigint NOT NULL,
        "status" "direct_debit_mandates_status_enum" NOT NULL,
        "authorizedAt" timestamptz,
        "expiresAt" timestamptz,
        "revokedAt" timestamptz,
        "failureReason" text,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_direct_debit_mandates_uuid" UNIQUE ("uuid")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_direct_debit_mandates_userId" ON "direct_debit_mandates" ("userId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_direct_debit_mandates_userId"`);
    await queryRunner.query(`DROP TABLE "direct_debit_mandates"`);
    await queryRunner.query(`DROP TYPE "direct_debit_mandates_status_enum"`);
  }
}
