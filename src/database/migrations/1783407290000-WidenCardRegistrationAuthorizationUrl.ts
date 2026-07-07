import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenCardRegistrationAuthorizationUrl1783407290000 implements MigrationInterface {
  name = 'WidenCardRegistrationAuthorizationUrl1783407290000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "card_registration_sessions" ALTER COLUMN "authorizationUrl" TYPE text',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "card_registration_sessions" ALTER COLUMN "authorizationUrl" TYPE character varying(255)',
    );
  }
}
