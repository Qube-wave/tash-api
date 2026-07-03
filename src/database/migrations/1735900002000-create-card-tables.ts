import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCardTables1735900002000 implements MigrationInterface {
  name = 'CreateCardTables1735900002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "cards_status_enum" AS ENUM ('pending', 'active', 'expired', 'disabled', 'revoked')`,
    );
    await queryRunner.query(
      `CREATE TYPE "card_registration_sessions_status_enum" AS ENUM ('created', 'pending', 'completed', 'failed', 'expired')`,
    );

    await queryRunner.query(`
      CREATE TABLE "cards" (
        "id" SERIAL PRIMARY KEY,
        "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" integer NOT NULL,
        "provider" varchar(50) NOT NULL,
        "providerCustomerId" varchar(120) NOT NULL,
        "providerCardToken" text NOT NULL,
        "authorizationReference" varchar(120) NOT NULL,
        "brand" varchar(40) NOT NULL,
        "lastFourDigits" varchar(4) NOT NULL,
        "expiryMonth" varchar(2) NOT NULL,
        "expiryYear" varchar(4) NOT NULL,
        "cardholderName" varchar(120),
        "bankName" varchar(120),
        "country" varchar(2),
        "currency" varchar(3) NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        "status" "cards_status_enum" NOT NULL DEFAULT 'pending',
        "lastChargedAt" timestamptz,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_cards_uuid" UNIQUE ("uuid")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cards_userId" ON "cards" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "card_registration_sessions" (
        "id" SERIAL PRIMARY KEY,
        "reference" varchar(80) NOT NULL,
        "userId" integer NOT NULL,
        "provider" varchar(50) NOT NULL,
        "authorizationUrl" varchar(255),
        "status" "card_registration_sessions_status_enum" NOT NULL,
        "cardId" integer,
        "failureReason" text,
        "expiresAt" timestamptz NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_card_registration_sessions_reference" UNIQUE ("reference")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_card_registration_sessions_userId" ON "card_registration_sessions" ("userId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_card_registration_sessions_userId"`,
    );
    await queryRunner.query(`DROP TABLE "card_registration_sessions"`);
    await queryRunner.query(`DROP INDEX "IDX_cards_userId"`);
    await queryRunner.query(`DROP TABLE "cards"`);
    await queryRunner.query(
      `DROP TYPE "card_registration_sessions_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "cards_status_enum"`);
  }
}
