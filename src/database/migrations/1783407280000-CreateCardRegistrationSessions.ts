import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCardRegistrationSessions1783407280000 implements MigrationInterface {
  name = 'CreateCardRegistrationSessions1783407280000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('card_registration_sessions');

    if (tableExists) {
      return;
    }

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "card_registration_sessions_status_enum" AS ENUM (
          'created',
          'pending',
          'verified',
          'completed',
          'failed',
          'expired'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE "card_registration_sessions" (
        "id" SERIAL NOT NULL,
        "reference" character varying(80) NOT NULL,
        "userId" integer NOT NULL,
        "provider" character varying(50) NOT NULL,
        "authorizationUrl" text,
        "status" "card_registration_sessions_status_enum" NOT NULL,
        "cardId" integer,
        "failureReason" text,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_card_registration_sessions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_card_registration_sessions_reference" ON "card_registration_sessions" ("reference")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_card_registration_sessions_userId" ON "card_registration_sessions" ("userId")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('card_registration_sessions');

    if (!tableExists) {
      return;
    }

    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_card_registration_sessions_userId"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_card_registration_sessions_reference"',
    );
    await queryRunner.query('DROP TABLE "card_registration_sessions"');
    await queryRunner.query(
      'DROP TYPE IF EXISTS "card_registration_sessions_status_enum"',
    );
  }
}
