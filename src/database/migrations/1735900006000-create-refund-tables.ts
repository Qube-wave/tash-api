import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefundTables1735900006000 implements MigrationInterface {
  name = 'CreateRefundTables1735900006000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "refunds_destination_type_enum" AS ENUM ('wallet', 'original_payment_method', 'virtual_account')`,
    );
    await queryRunner.query(
      `CREATE TYPE "refunds_status_enum" AS ENUM ('pending', 'processing', 'successful', 'failed', 'cancelled')`,
    );

    await queryRunner.query(`
      CREATE TABLE "refunds" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "transactionId" integer NOT NULL,
        "parentRefundId" integer,
        "userId" integer NOT NULL,
        "merchantId" integer,
        "walletId" integer,
        "provider" varchar(50),
        "providerReference" varchar(120),
        "reference" varchar(80) NOT NULL,
        "amount" bigint NOT NULL,
        "currency" varchar(3) NOT NULL,
        "destinationType" "refunds_destination_type_enum" NOT NULL,
        "destinationReference" varchar(160),
        "reason" text,
        "status" "refunds_status_enum" NOT NULL,
        "failureReason" text,
        "processedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refunds_uuid" UNIQUE ("uuid"),
        CONSTRAINT "UQ_refunds_reference" UNIQUE ("reference")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_refunds_transactionId" ON "refunds" ("transactionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refunds_userId" ON "refunds" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refunds_merchantId" ON "refunds" ("merchantId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_refunds_merchantId"`);
    await queryRunner.query(`DROP INDEX "IDX_refunds_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_refunds_transactionId"`);
    await queryRunner.query(`DROP TABLE "refunds"`);
    await queryRunner.query(`DROP TYPE "refunds_status_enum"`);
    await queryRunner.query(`DROP TYPE "refunds_destination_type_enum"`);
  }
}
