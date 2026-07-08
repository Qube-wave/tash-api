import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema1783407270000 implements MigrationInterface {
  name = 'CreateInitialSchema1783407270000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const enums: Array<[string, string[]]> = [
      ['user_status_enum', ['pending_registration', 'active', 'suspended', 'disabled']],
      ['user_type_enum', ['consumer', 'merchant', 'admin']],
      ['registration_sessions_currentstep_enum', ['profile', 'claim_tag', 'pin', 'complete']],
      ['verification_tokens_type_enum', ['email', 'phone', 'password_reset']],
      ['wallets_status_enum', ['active', 'restricted', 'suspended', 'closed']],
      ['wallet_ledger_entries_direction_enum', ['credit', 'debit']],
      [
        'wallet_ledger_entries_entrytype_enum',
        [
          'card_funding',
          'direct_debit_funding',
          'virtual_account_funding',
          'transfer_sent',
          'transfer_received',
          'merchant_payment',
          'refund_received',
          'refund_debit',
          'reversal',
          'adjustment',
        ],
      ],
      ['wallet_ledger_entries_status_enum', ['pending', 'completed', 'reversed']],
      [
        'transactions_type_enum',
        [
          'card_registration',
          'card_charge',
          'card_wallet_funding',
          'direct_debit_registration',
          'direct_debit_charge',
          'direct_debit_wallet_funding',
          'virtual_account_funding',
          'wallet_transfer',
          'merchant_payment',
          'refund',
          'reversal',
        ],
      ],
      ['transactions_direction_enum', ['credit', 'debit', 'neutral']],
      [
        'transactions_status_enum',
        [
          'created',
          'pending',
          'requires_action',
          'processing',
          'successful',
          'failed',
          'cancelled',
          'reversed',
          'partially_refunded',
          'refunded',
        ],
      ],
      ['cards_status_enum', ['pending', 'active', 'expired', 'disabled', 'revoked']],
      [
        'card_registration_sessions_status_enum',
        ['created', 'pending', 'verified', 'completed', 'failed', 'expired'],
      ],
      [
        'direct_debit_mandates_status_enum',
        ['pending', 'requires_authorization', 'active', 'failed', 'expired', 'revoked'],
      ],
      ['virtual_accounts_type_enum', ['static', 'temporary']],
      ['virtual_accounts_purpose_enum', ['wallet_funding', 'refund']],
      ['virtual_accounts_status_enum', ['pending', 'active', 'expired', 'disabled', 'failed']],
      ['bvn_profiles_verificationstatus_enum', ['pending', 'verified', 'failed', 'rejected']],
      ['merchants_verificationstatus_enum', ['unverified', 'pending', 'verified', 'rejected']],
      ['merchants_status_enum', ['active', 'suspended', 'disabled']],
      ['merchant_api_keys_environment_enum', ['test', 'live']],
      ['merchant_api_keys_status_enum', ['active', 'revoked', 'expired']],
      ['merchant_customers_status_enum', ['active', 'disabled']],
      ['merchant_webhook_deliveries_status_enum', ['pending', 'delivered', 'failed']],
      [
        'pay_with_tash_sessions_status_enum',
        [
          'created',
          'requires_authentication',
          'requires_payment_method',
          'processing',
          'successful',
          'failed',
          'cancelled',
          'expired',
        ],
      ],
      ['refunds_destinationtype_enum', ['wallet', 'original_payment_method', 'virtual_account']],
      ['refunds_status_enum', ['pending', 'processing', 'successful', 'failed', 'cancelled']],
      ['webhook_events_status_enum', ['received', 'processing', 'processed', 'failed']],
      ['idempotency_records_status_enum', ['processing', 'completed', 'failed']],
    ];

    for (const [name, values] of enums) {
      await this.createEnum(queryRunner, name, values);
    }

    const tables: Array<[string, string]> = [
      [
        'users',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "email" character varying(255),
          "phoneNumber" character varying(32),
          "paymentTag" character varying(32),
          "status" "user_status_enum" NOT NULL DEFAULT 'pending_registration',
          "userTypes" "user_type_enum" array NOT NULL DEFAULT ARRAY['consumer']::"user_type_enum"[],
          "emailVerifiedAt" TIMESTAMP WITH TIME ZONE,
          "phoneVerifiedAt" TIMESTAMP WITH TIME ZONE,
          "lastLoginAt" TIMESTAMP WITH TIME ZONE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'user_profiles',
        `
          "id" SERIAL NOT NULL,
          "userId" integer NOT NULL,
          "firstName" character varying(100) NOT NULL,
          "lastName" character varying(100) NOT NULL,
          "dateOfBirth" date NOT NULL,
          "country" character varying(2) NOT NULL DEFAULT 'NG',
          "defaultCurrency" character varying(3) NOT NULL DEFAULT 'NGN',
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_user_profiles_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'registration_sessions',
        `
          "id" SERIAL NOT NULL,
          "tokenId" uuid NOT NULL,
          "tokenHash" character varying(255) NOT NULL,
          "userId" integer NOT NULL,
          "currentStep" "registration_sessions_currentstep_enum" NOT NULL DEFAULT 'profile',
          "completedAt" TIMESTAMP WITH TIME ZONE,
          "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_registration_sessions_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'verification_tokens',
        `
          "id" SERIAL NOT NULL,
          "tokenId" uuid NOT NULL,
          "userId" integer,
          "email" character varying,
          "phoneNumber" character varying,
          "type" "verification_tokens_type_enum" NOT NULL,
          "tokenHash" character varying(255) NOT NULL,
          "attempts" integer NOT NULL DEFAULT 0,
          "maxAttempts" integer NOT NULL,
          "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "consumedAt" TIMESTAMP WITH TIME ZONE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_verification_tokens_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'refresh_tokens',
        `
          "id" SERIAL NOT NULL,
          "tokenId" uuid NOT NULL,
          "userId" integer NOT NULL,
          "tokenHash" character varying(255) NOT NULL,
          "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "revokedAt" TIMESTAMP WITH TIME ZONE,
          "replacedByTokenId" uuid,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'wallets',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "userId" integer NOT NULL,
          "currency" character varying(3) NOT NULL,
          "availableBalance" bigint NOT NULL DEFAULT 0,
          "pendingBalance" bigint NOT NULL DEFAULT 0,
          "ledgerBalance" bigint NOT NULL DEFAULT 0,
          "status" "wallets_status_enum" NOT NULL DEFAULT 'active',
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_wallets_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'transactions',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "reference" character varying(64) NOT NULL,
          "userId" integer NOT NULL,
          "merchantId" integer,
          "walletId" integer,
          "cardId" integer,
          "directDebitMandateId" integer,
          "virtualAccountId" integer,
          "payWithTashSessionId" integer,
          "parentTransactionId" integer,
          "provider" character varying(50),
          "providerReference" character varying(120),
          "externalReference" character varying(120),
          "type" "transactions_type_enum" NOT NULL,
          "direction" "transactions_direction_enum" NOT NULL,
          "amount" bigint NOT NULL,
          "fee" bigint NOT NULL DEFAULT 0,
          "netAmount" bigint NOT NULL,
          "currency" character varying(3) NOT NULL,
          "status" "transactions_status_enum" NOT NULL,
          "failureCode" character varying(80),
          "failureReason" text,
          "description" text,
          "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "initiatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "completedAt" TIMESTAMP WITH TIME ZONE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'wallet_ledger_entries',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "walletId" integer NOT NULL,
          "transactionId" integer NOT NULL,
          "reference" character varying(80) NOT NULL,
          "direction" "wallet_ledger_entries_direction_enum" NOT NULL,
          "entryType" "wallet_ledger_entries_entrytype_enum" NOT NULL,
          "amount" bigint NOT NULL,
          "currency" character varying(3) NOT NULL,
          "balanceBefore" bigint NOT NULL,
          "balanceAfter" bigint NOT NULL,
          "status" "wallet_ledger_entries_status_enum" NOT NULL,
          "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_wallet_ledger_entries_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'cards',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "userId" integer NOT NULL,
          "provider" character varying(50) NOT NULL,
          "providerCustomerId" character varying(120) NOT NULL,
          "providerCardToken" text NOT NULL,
          "authorizationReference" character varying(120) NOT NULL,
          "brand" character varying(40) NOT NULL,
          "lastFourDigits" character varying(4) NOT NULL,
          "expiryMonth" character varying(2) NOT NULL,
          "expiryYear" character varying(4) NOT NULL,
          "cardholderName" character varying(120),
          "bankName" character varying(120),
          "country" character varying(2),
          "currency" character varying(3) NOT NULL,
          "isDefault" boolean NOT NULL DEFAULT false,
          "status" "cards_status_enum" NOT NULL DEFAULT 'pending',
          "lastChargedAt" TIMESTAMP WITH TIME ZONE,
          "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_cards_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'card_registration_sessions',
        `
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
        `,
      ],
      [
        'direct_debit_mandates',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "userId" integer NOT NULL,
          "provider" character varying(50) NOT NULL,
          "providerCustomerId" character varying(120),
          "providerMandateId" character varying(120) NOT NULL,
          "authorizationReference" character varying(120),
          "bankName" character varying(120),
          "accountName" character varying(120),
          "accountNumberLastFour" character varying(4),
          "bankCode" character varying(20) NOT NULL,
          "currency" character varying(3) NOT NULL,
          "maximumAmount" bigint NOT NULL,
          "status" "direct_debit_mandates_status_enum" NOT NULL,
          "authorizedAt" TIMESTAMP WITH TIME ZONE,
          "expiresAt" TIMESTAMP WITH TIME ZONE,
          "revokedAt" TIMESTAMP WITH TIME ZONE,
          "failureReason" text,
          "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_direct_debit_mandates_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'virtual_accounts',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "userId" integer NOT NULL,
          "walletId" integer NOT NULL,
          "provider" character varying(50) NOT NULL,
          "providerCustomerId" character varying(120),
          "providerAccountId" character varying(120) NOT NULL,
          "accountName" character varying(160) NOT NULL,
          "accountNumber" character varying(20) NOT NULL,
          "bankName" character varying(120) NOT NULL,
          "bankCode" character varying(20),
          "currency" character varying(3) NOT NULL,
          "type" "virtual_accounts_type_enum" NOT NULL,
          "purpose" "virtual_accounts_purpose_enum" NOT NULL,
          "status" "virtual_accounts_status_enum" NOT NULL,
          "expiresAt" TIMESTAMP WITH TIME ZONE,
          "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_virtual_accounts_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'bvn_profiles',
        `
          "id" SERIAL NOT NULL,
          "userId" integer NOT NULL,
          "encryptedBvn" text NOT NULL,
          "maskedBvn" character varying(16) NOT NULL,
          "provider" character varying(50) NOT NULL,
          "providerCustomerId" character varying(120),
          "verificationReference" character varying(120) NOT NULL,
          "verificationStatus" "bvn_profiles_verificationstatus_enum" NOT NULL,
          "verifiedFirstName" character varying(100),
          "verifiedLastName" character varying(100),
          "verifiedDateOfBirth" date,
          "verifiedPhoneNumber" character varying(32),
          "verifiedAt" TIMESTAMP WITH TIME ZONE,
          "failureReason" text,
          "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_bvn_profiles_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'merchants',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "ownerId" integer NOT NULL,
          "businessName" character varying(160) NOT NULL,
          "displayName" character varying(120) NOT NULL,
          "merchantCode" character varying(40) NOT NULL,
          "email" character varying(255) NOT NULL,
          "phoneNumber" character varying(32) NOT NULL,
          "businessType" character varying(80) NOT NULL,
          "registrationNumber" character varying(80),
          "country" character varying(2) NOT NULL,
          "defaultCurrency" character varying(3) NOT NULL,
          "verificationStatus" "merchants_verificationstatus_enum" NOT NULL,
          "status" "merchants_status_enum" NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_merchants_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'merchant_api_keys',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "merchantId" integer NOT NULL,
          "name" character varying(80) NOT NULL,
          "keyPrefix" character varying(24) NOT NULL,
          "secretHash" character varying(255) NOT NULL,
          "environment" "merchant_api_keys_environment_enum" NOT NULL,
          "status" "merchant_api_keys_status_enum" NOT NULL,
          "lastUsedAt" TIMESTAMP WITH TIME ZONE,
          "expiresAt" TIMESTAMP WITH TIME ZONE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_merchant_api_keys_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'merchant_settings',
        `
          "id" SERIAL NOT NULL,
          "merchantId" integer NOT NULL,
          "webhookUrl" character varying(500),
          "webhookSecretHash" character varying(255),
          "webhookSecretCiphertext" text,
          "callbackUrl" character varying(500),
          "allowedRedirectUrls" text array NOT NULL DEFAULT ARRAY[]::text[],
          "allowCardPayments" boolean NOT NULL DEFAULT true,
          "allowDirectDebitPayments" boolean NOT NULL DEFAULT true,
          "allowWalletPayments" boolean NOT NULL DEFAULT true,
          "checkoutName" character varying(120),
          "checkoutDescription" text,
          "checkoutLogoUrl" character varying(500),
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_merchant_settings_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'merchant_customers',
        `
          "id" SERIAL NOT NULL,
          "merchantId" integer NOT NULL,
          "userId" integer NOT NULL,
          "merchantCustomerReference" character varying(120),
          "status" "merchant_customers_status_enum" NOT NULL,
          "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_merchant_customers_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'merchant_webhook_deliveries',
        `
          "id" SERIAL NOT NULL,
          "merchantId" integer NOT NULL,
          "eventId" character varying(80) NOT NULL,
          "eventType" character varying(120) NOT NULL,
          "url" character varying(500) NOT NULL,
          "payload" jsonb NOT NULL,
          "signature" text NOT NULL,
          "status" "merchant_webhook_deliveries_status_enum" NOT NULL,
          "responseStatus" integer,
          "responseBody" text,
          "attemptCount" integer NOT NULL DEFAULT 0,
          "nextRetryAt" TIMESTAMP WITH TIME ZONE,
          "deliveredAt" TIMESTAMP WITH TIME ZONE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_merchant_webhook_deliveries_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'pay_with_tash_sessions',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "reference" character varying(80) NOT NULL,
          "merchantId" integer NOT NULL,
          "userId" integer,
          "transactionId" integer,
          "amount" bigint NOT NULL,
          "currency" character varying(3) NOT NULL,
          "description" text,
          "merchantReference" character varying(120) NOT NULL,
          "callbackUrl" character varying(500),
          "redirectUrl" character varying(500),
          "status" "pay_with_tash_sessions_status_enum" NOT NULL,
          "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_pay_with_tash_sessions_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'refunds',
        `
          "id" SERIAL NOT NULL,
          "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "transactionId" integer NOT NULL,
          "parentRefundId" integer,
          "userId" integer NOT NULL,
          "merchantId" integer,
          "walletId" integer,
          "provider" character varying(50),
          "providerReference" character varying(120),
          "reference" character varying(80) NOT NULL,
          "amount" bigint NOT NULL,
          "currency" character varying(3) NOT NULL,
          "destinationType" "refunds_destinationtype_enum" NOT NULL,
          "destinationReference" character varying(160),
          "reason" text,
          "status" "refunds_status_enum" NOT NULL,
          "failureReason" text,
          "processedAt" TIMESTAMP WITH TIME ZONE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_refunds_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'webhook_events',
        `
          "id" SERIAL NOT NULL,
          "provider" character varying(50) NOT NULL,
          "providerEventId" character varying(120) NOT NULL,
          "eventType" character varying(120) NOT NULL,
          "signature" text,
          "payload" jsonb NOT NULL,
          "status" "webhook_events_status_enum" NOT NULL,
          "processingAttempts" integer NOT NULL DEFAULT 0,
          "lastError" text,
          "processedAt" TIMESTAMP WITH TIME ZONE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_webhook_events_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'idempotency_records',
        `
          "id" SERIAL NOT NULL,
          "userId" integer,
          "merchantId" integer,
          "route" character varying(180) NOT NULL,
          "idempotencyKey" character varying(120) NOT NULL,
          "requestHash" character varying(64) NOT NULL,
          "responseStatus" integer,
          "responseBody" jsonb,
          "status" "idempotency_records_status_enum" NOT NULL,
          "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_idempotency_records_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'transaction_pins',
        `
          "id" SERIAL NOT NULL,
          "userId" integer NOT NULL,
          "pinHash" character varying(255) NOT NULL,
          "failedAttempts" integer NOT NULL DEFAULT 0,
          "lockedUntil" TIMESTAMP WITH TIME ZONE,
          "lastChangedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_transaction_pins_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'user_payment_settings',
        `
          "id" SERIAL NOT NULL,
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
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_user_payment_settings_id" PRIMARY KEY ("id")
        `,
      ],
      [
        'audit_logs',
        `
          "id" SERIAL NOT NULL,
          "userId" integer,
          "merchantId" integer,
          "action" character varying(120) NOT NULL,
          "resourceType" character varying(80),
          "resourceId" character varying(120),
          "ipAddress" character varying(64),
          "userAgent" character varying(255),
          "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
        `,
      ],
    ];

    for (const [name, columns] of tables) {
      await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${name}" (${columns})`);
    }

    const indexes: Array<[string, string, string[], boolean]> = [
      ['IDX_951b8f1dfc94ac1d0301a14b7e', 'users', ['uuid'], true],
      ['IDX_97672ac88f789774dd47f7c8be', 'users', ['email'], true],
      ['IDX_1e3d0240b49c40521aaeb95329', 'users', ['phoneNumber'], true],
      ['IDX_4432d7ce30b1f9c0ae31101e1c', 'users', ['paymentTag'], true],
      ['IDX_8481388d6325e752cd4d7e26c6', 'user_profiles', ['userId'], true],
      ['IDX_26f0fb634c7df9c674879f9489', 'registration_sessions', ['tokenId'], true],
      ['IDX_d517555d90942e2adfb7e66fe0', 'registration_sessions', ['userId'], false],
      ['IDX_d76d7b42cb10bce934467b2d8a', 'verification_tokens', ['tokenId'], true],
      ['IDX_8eb720a87e85b20fdfc69c3826', 'verification_tokens', ['userId'], false],
      ['IDX_c1894684e3901e727838393c97', 'verification_tokens', ['email'], false],
      ['IDX_bb560d55de933ed03f772d122d', 'verification_tokens', ['phoneNumber'], false],
      ['IDX_48064cd66bef5bbbcc3eb19622', 'refresh_tokens', ['tokenId'], true],
      ['IDX_610102b60fea1455310ccd299d', 'refresh_tokens', ['userId'], false],
      ['IDX_a5f8a39fa727c68891bdf93ad9', 'wallets', ['uuid'], true],
      ['IDX_2ecdb33f23e9a6fc392025c0b9', 'wallets', ['userId'], false],
      ['IDX_01627e643864b58b6e6e679414', 'wallets', ['userId', 'currency'], true],
      ['IDX_71ee7072c1ba2c23edc34fabfe', 'transactions', ['uuid'], true],
      ['IDX_dd85cc865e0c3d5d4be095d3f3', 'transactions', ['reference'], true],
      ['IDX_6bb58f2b6e30cb51a6504599f4', 'transactions', ['userId'], false],
      ['IDX_a88f466d39796d3081cf96e1b6', 'transactions', ['walletId'], false],
      ['IDX_d1d942855e236856ef4740ed50', 'wallet_ledger_entries', ['uuid'], true],
      ['IDX_8e50f3f4425d99d4060af1888b', 'wallet_ledger_entries', ['walletId'], false],
      ['IDX_db93ffcf51c50585e14b14c2b0', 'wallet_ledger_entries', ['transactionId'], false],
      ['IDX_ba6d4e1da7f95e8b5322513c87', 'wallet_ledger_entries', ['reference'], false],
      ['IDX_cb3789f0e79e124e5753da0010', 'cards', ['uuid'], true],
      ['IDX_7b7230897ecdeb7d6b0576d907', 'cards', ['userId'], false],
      ['IDX_f8a1ea81489c0cfcf400c0d464', 'card_registration_sessions', ['reference'], true],
      ['IDX_5426a232f73d7a928e3f79fb23', 'card_registration_sessions', ['userId'], false],
      ['IDX_183655abc6ec6b77654ea29de3', 'direct_debit_mandates', ['uuid'], true],
      ['IDX_94decf8357ee3e481c49817ecd', 'direct_debit_mandates', ['userId'], false],
      ['IDX_bfbb6837b3b7958f5e5893af69', 'virtual_accounts', ['uuid'], true],
      ['IDX_07dc2370a92290eff490df15e2', 'virtual_accounts', ['userId'], false],
      ['IDX_1519af2f94656c628e5212c337', 'virtual_accounts', ['walletId'], false],
      ['IDX_168b88cfe92239fd553935c3fa', 'virtual_accounts', ['providerAccountId'], false],
      ['IDX_72dae0e0239c333dece43e4feb', 'virtual_accounts', ['accountNumber'], false],
      ['IDX_f3d409a8cb5ac53d7151bb910a', 'bvn_profiles', ['userId'], true],
      ['IDX_3a3541ce5650a28522df6e5073', 'merchants', ['uuid'], true],
      ['IDX_6af2eb7c91c18bec8a5b2a3f65', 'merchants', ['ownerId'], false],
      ['IDX_4e80372acdf005665d657d164d', 'merchants', ['merchantCode'], true],
      ['IDX_f091ad726d03193bf7bffe154f', 'merchant_api_keys', ['uuid'], true],
      ['IDX_3d69aa89acf97cf49dbd413b9c', 'merchant_api_keys', ['merchantId'], false],
      ['IDX_cf55634139d36a819c1c2963ea', 'merchant_api_keys', ['keyPrefix'], false],
      ['IDX_0add1ff9ee5e69ebc8e4fbc469', 'merchant_settings', ['merchantId'], true],
      ['IDX_b80abea81ee2772d2015e83fc0', 'merchant_customers', ['merchantId', 'userId'], true],
      ['IDX_d37a6869dc700f473c766c4590', 'merchant_webhook_deliveries', ['merchantId'], false],
      ['IDX_d500f337c0a354d735c0e82b1d', 'merchant_webhook_deliveries', ['eventId'], false],
      ['IDX_df01984a2ba7c6d59a38a8cbec', 'pay_with_tash_sessions', ['uuid'], true],
      ['IDX_19d9544d8dd0509a6db8240d62', 'pay_with_tash_sessions', ['reference'], true],
      ['IDX_5aa8a1295e424c98eb50c83944', 'pay_with_tash_sessions', ['merchantId'], false],
      ['IDX_e3ddbc80656bce7ee6f095c47c', 'refunds', ['uuid'], true],
      ['IDX_b2b8c0c33487a5b9a573767355', 'refunds', ['transactionId'], false],
      ['IDX_be8d9d517a91f237ba098909c1', 'refunds', ['userId'], false],
      ['IDX_47c4aea1c9b6d982340f81a581', 'refunds', ['merchantId'], false],
      ['IDX_722ff4a1db27817dbe5facce71', 'refunds', ['reference'], true],
      ['IDX_f9824a75e1373c0a43c0d8d17c', 'webhook_events', ['provider', 'providerEventId'], true],
      ['IDX_e6104a0526ff65649a16c236dd', 'idempotency_records', ['userId'], false],
      ['IDX_6208da0222a069f3c14c947910', 'idempotency_records', ['userId', 'route', 'idempotencyKey'], true],
      ['IDX_d468cbede28f436e2f198f3df8', 'transaction_pins', ['userId'], true],
      ['IDX_35211b94d750e408cb69457de8', 'user_payment_settings', ['userId'], true],
      ['IDX_cfa83f61e4d27a87fcae1e025a', 'audit_logs', ['userId'], false],
      ['IDX_cf9393a92feee6af80e2aa689f', 'audit_logs', ['merchantId'], false],
    ];

    for (const [name, table, columns, unique] of indexes) {
      await this.createIndex(queryRunner, name, table, columns, unique);
    }

    await this.addUniqueConstraint(
      queryRunner,
      'REL_8481388d6325e752cd4d7e26c6',
      'user_profiles',
      ['userId'],
    );
    await this.addForeignKey(
      queryRunner,
      'FK_8481388d6325e752cd4d7e26c6d',
      'user_profiles',
      ['userId'],
      'users',
      ['id'],
      'CASCADE',
    );
    await this.addForeignKey(
      queryRunner,
      'FK_d517555d90942e2adfb7e66fe0f',
      'registration_sessions',
      ['userId'],
      'users',
      ['id'],
      'CASCADE',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "registration_sessions" DROP CONSTRAINT IF EXISTS "FK_d517555d90942e2adfb7e66fe0f"');
    await queryRunner.query('ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "FK_8481388d6325e752cd4d7e26c6d"');
    await queryRunner.query('ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "REL_8481388d6325e752cd4d7e26c6"');

    const tables = [
      'audit_logs',
      'user_payment_settings',
      'transaction_pins',
      'idempotency_records',
      'webhook_events',
      'refunds',
      'pay_with_tash_sessions',
      'merchant_webhook_deliveries',
      'merchant_customers',
      'merchant_settings',
      'merchant_api_keys',
      'merchants',
      'bvn_profiles',
      'virtual_accounts',
      'direct_debit_mandates',
      'card_registration_sessions',
      'cards',
      'wallet_ledger_entries',
      'transactions',
      'wallets',
      'refresh_tokens',
      'verification_tokens',
      'registration_sessions',
      'user_profiles',
      'users',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }

    const enums = [
      'idempotency_records_status_enum',
      'webhook_events_status_enum',
      'refunds_status_enum',
      'refunds_destinationtype_enum',
      'pay_with_tash_sessions_status_enum',
      'merchant_webhook_deliveries_status_enum',
      'merchant_customers_status_enum',
      'merchant_api_keys_status_enum',
      'merchant_api_keys_environment_enum',
      'merchants_status_enum',
      'merchants_verificationstatus_enum',
      'bvn_profiles_verificationstatus_enum',
      'virtual_accounts_status_enum',
      'virtual_accounts_purpose_enum',
      'virtual_accounts_type_enum',
      'direct_debit_mandates_status_enum',
      'card_registration_sessions_status_enum',
      'cards_status_enum',
      'transactions_status_enum',
      'transactions_direction_enum',
      'transactions_type_enum',
      'wallet_ledger_entries_status_enum',
      'wallet_ledger_entries_entrytype_enum',
      'wallet_ledger_entries_direction_enum',
      'wallets_status_enum',
      'verification_tokens_type_enum',
      'registration_sessions_currentstep_enum',
      'user_type_enum',
      'user_status_enum',
    ];

    for (const name of enums) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${name}"`);
    }
  }

  private async createEnum(
    queryRunner: QueryRunner,
    name: string,
    values: string[],
  ): Promise<void> {
    const enumValues = values.map((value) => `'${value}'`).join(', ');

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "${name}" AS ENUM (${enumValues});
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
  }

  private async createIndex(
    queryRunner: QueryRunner,
    name: string,
    table: string,
    columns: string[],
    unique: boolean,
  ): Promise<void> {
    const uniqueSql = unique ? 'UNIQUE ' : '';
    const columnSql = columns.map((column) => `"${column}"`).join(', ');

    await queryRunner.query(
      `CREATE ${uniqueSql}INDEX IF NOT EXISTS "${name}" ON "${table}" (${columnSql})`,
    );
  }

  private async addUniqueConstraint(
    queryRunner: QueryRunner,
    name: string,
    table: string,
    columns: string[],
  ): Promise<void> {
    const columnSql = columns.map((column) => `"${column}"`).join(', ');

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "${table}" ADD CONSTRAINT "${name}" UNIQUE (${columnSql});
        END IF;
      END $$
    `);
  }

  private async addForeignKey(
    queryRunner: QueryRunner,
    name: string,
    table: string,
    columns: string[],
    referencedTable: string,
    referencedColumns: string[],
    onDelete: string,
  ): Promise<void> {
    const columnSql = columns.map((column) => `"${column}"`).join(', ');
    const referencedColumnSql = referencedColumns
      .map((column) => `"${column}"`)
      .join(', ');

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "${table}" ADD CONSTRAINT "${name}"
          FOREIGN KEY (${columnSql}) REFERENCES "${referencedTable}" (${referencedColumnSql})
          ON DELETE ${onDelete};
        END IF;
      END $$
    `);
  }
}
