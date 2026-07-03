import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReliabilityTables1735900007000 implements MigrationInterface {
  name = 'CreateReliabilityTables1735900007000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merchant_settings" ADD "webhookSecretCiphertext" text`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merchant_webhook_deliveries_status_nextRetryAt" ON "merchant_webhook_deliveries" ("status", "nextRetryAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer,
        "merchantId" integer,
        "action" varchar(120) NOT NULL,
        "resourceType" varchar(80),
        "resourceId" varchar(120),
        "ipAddress" varchar(64),
        "userAgent" varchar(255),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_userId" ON "audit_logs" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_merchantId" ON "audit_logs" ("merchantId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_merchantId"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_userId"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(
      `DROP INDEX "IDX_merchant_webhook_deliveries_status_nextRetryAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_settings" DROP COLUMN "webhookSecretCiphertext"`,
    );
  }
}
