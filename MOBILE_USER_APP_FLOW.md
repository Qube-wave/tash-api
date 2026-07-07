# Mobile User App Flow

This document describes the consumer mobile application flow. It excludes merchant-specific features.

## API Response Envelope

Successful responses are wrapped by the API response interceptor:

```json
{
  "success": true,
  "data": {}
}
```

Error responses use this structure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed.",
    "details": []
  },
  "requestId": "req_00000000-0000-0000-0000-000000000000"
}
```

Examples below show the full response envelope unless otherwise stated.

## Core Principles

- The app uses OTP-based authentication. There are no passwords.
- The user creates a transaction PIN during onboarding.
- The mobile app uses the server to unlock sessions and refresh tokens.
- The app must never persist OTPs, transaction PINs, card PINs, card numbers, CVV values, or raw provider metadata.
- Recipient resolution for user transfers must use payment tag only.
- Profile identity fields are read-only until KYC is implemented.

## Token Storage

Store refresh tokens only in secure device storage:

- iOS: Keychain
- Android: Keystore-backed secure storage

Access tokens should be treated as short-lived session data. Keeping them in memory is preferred. If cached, they must be stored securely and cleared on logout.

The mobile app should never log:

- Authorization headers
- access tokens
- refresh tokens
- OTPs
- transaction PINs
- card PINs
- card number
- CVV

## Shared Data Shapes

### Auth Response

Returned by login, onboarding completion, refresh, and unlock.

```json
{
  "success": true,
  "data": {
    "accessToken": "<access-token>",
    "accessTokenExpiresIn": 900,
    "refreshToken": "<refresh-token>",
    "refreshTokenExpiresIn": 2592000,
    "user": {
      "uuid": "f2e5dab0-ea71-4c52-9f3a-eb0a71d6bd0f",
      "email": "user@example.com",
      "phoneNumber": null,
      "paymentTag": "tashuser",
      "status": "active",
      "userTypes": ["consumer"],
      "profile": {
        "firstName": "Tash",
        "lastName": "User",
        "dateOfBirth": "1998-01-01",
        "country": "NG",
        "defaultCurrency": "NGN"
      }
    }
  }
}
```

### Public User Profile

```json
{
  "uuid": "f2e5dab0-ea71-4c52-9f3a-eb0a71d6bd0f",
  "email": "user@example.com",
  "phoneNumber": null,
  "paymentTag": "tashuser",
  "status": "active",
  "userTypes": ["consumer"],
  "profile": {
    "firstName": "Tash",
    "lastName": "User",
    "dateOfBirth": "1998-01-01",
    "country": "NG",
    "defaultCurrency": "NGN"
  }
}
```

### Wallet

```json
{
  "walletUuid": "4d41f334-8645-4206-b0af-cd908e68b940",
  "currency": "NGN",
  "availableBalance": 25000,
  "ledgerBalance": 25000,
  "status": "active"
}
```

### Card

```json
{
  "uuid": "8df1199a-6b63-4f05-9b7c-2cfe87cfb123",
  "brand": "visa",
  "lastFourDigits": "1111",
  "expiryMonth": "12",
  "expiryYear": "2030",
  "cardholderName": "Tash User",
  "bankName": null,
  "country": null,
  "currency": "NGN",
  "isDefault": true,
  "status": "active",
  "lastChargedAt": null,
  "createdAt": "2026-07-07T00:00:00.000Z"
}
```

## App Launch

On every app launch:

1. Check secure storage for a refresh token.
2. If no refresh token exists, show the auth entry screen.
3. If a refresh token exists, show the PIN unlock screen.
4. Submit the refresh token and PIN to the server.

```http
POST /api/v1/auth/unlock
Content-Type: application/json
```

Request:

```json
{
  "refreshToken": "<stored-refresh-token>",
  "pin": "1234"
}
```

Response: `Auth Response`.

If unlock fails because the refresh token is expired or invalid, clear local session data and send the user to login.

## Authentication

### Signup Entry

The user chooses email or phone.

Send email OTP:

```http
POST /api/v1/auth/send-email-verification
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "message": "A verification code has been sent to your email"
  }
}
```

Send phone OTP:

```http
POST /api/v1/auth/send-phone-verification
Content-Type: application/json
```

Request:

```json
{
  "phoneNumber": "+2348012345678"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "message": "A verification code has been sent to your phone"
  }
}
```

Complete email verification:

```http
POST /api/v1/auth/complete-email-verification
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com",
  "token": "222222"
}
```

Complete phone verification:

```http
POST /api/v1/auth/complete-phone-verification
Content-Type: application/json
```

Request:

```json
{
  "phoneNumber": "+2348012345678",
  "token": "222222"
}
```

Successful verification response:

```json
{
  "success": true,
  "data": {
    "message": "Verification completed.",
    "isVerified": true,
    "onboardingSessionToken": "registration-session-token",
    "currentStep": "profile"
  }
}
```

The mobile app should store `onboardingSessionToken` temporarily until onboarding completes.

### Login

The user chooses email or phone.

Send login email OTP:

```http
POST /api/v1/auth/login/email/send-verification
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com"
}
```

Send login phone OTP:

```http
POST /api/v1/auth/login/phone/send-verification
Content-Type: application/json
```

Request:

```json
{
  "phoneNumber": "+2348012345678"
}
```

Send-login response:

```json
{
  "success": true,
  "data": {
    "message": "A verification code has been sent"
  }
}
```

Complete login email OTP:

```http
POST /api/v1/auth/login/email/complete-verification
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com",
  "token": "222222"
}
```

Complete login phone OTP:

```http
POST /api/v1/auth/login/phone/complete-verification
Content-Type: application/json
```

Request:

```json
{
  "phoneNumber": "+2348012345678",
  "token": "222222"
}
```

Response: `Auth Response`.

Only active users can login. If the backend indicates the user is pending registration, route the user back into onboarding.

## Onboarding

Onboarding uses the `onboardingSessionToken` returned after signup OTP verification.

Recommended mobile sequence:

1. Profile registration
2. Claim payment tag
3. Create transaction PIN
4. Receive auth tokens
5. Enter the main app

### Complete Profile

```http
POST /api/v1/auth/onboarding/profile
Content-Type: application/json
```

Request:

```json
{
  "onboardingSessionToken": "registration-session-token",
  "firstName": "Tash",
  "lastName": "User",
  "dateOfBirth": "1998-01-01"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "currentStep": "claim_tag",
    "user": {
      "uuid": "f2e5dab0-ea71-4c52-9f3a-eb0a71d6bd0f",
      "email": "user@example.com",
      "phoneNumber": null,
      "paymentTag": null,
      "status": "pending_registration",
      "userTypes": ["consumer"],
      "profile": {
        "firstName": "Tash",
        "lastName": "User",
        "dateOfBirth": "1998-01-01",
        "country": "NG",
        "defaultCurrency": "NGN"
      }
    }
  }
}
```

The profile step collects identity details required by the app. These fields are not editable later until KYC is implemented.

### Claim Payment Tag

```http
POST /api/v1/auth/onboarding/tag
Content-Type: application/json
```

Request:

```json
{
  "onboardingSessionToken": "registration-session-token",
  "paymentTag": "tashuser"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "currentStep": "pin",
    "user": {
      "uuid": "f2e5dab0-ea71-4c52-9f3a-eb0a71d6bd0f",
      "email": "user@example.com",
      "phoneNumber": null,
      "paymentTag": "tashuser",
      "status": "pending_registration",
      "userTypes": ["consumer"],
      "profile": {
        "firstName": "Tash",
        "lastName": "User",
        "dateOfBirth": "1998-01-01",
        "country": "NG",
        "defaultCurrency": "NGN"
      }
    }
  }
}
```

The payment tag is the user's public payment identifier.

### Create Transaction PIN

```http
POST /api/v1/auth/onboarding/pin
Content-Type: application/json
```

Request:

```json
{
  "onboardingSessionToken": "registration-session-token",
  "pin": "1234"
}
```

Response: `Auth Response`.

The backend activates the user and creates the default wallet.

### Abandoned Onboarding

If the user abandons onboarding, they can resume by verifying the same email or phone again. The backend returns a fresh onboarding session at the current incomplete step.

## Session Management

### Refresh

```http
POST /api/v1/auth/refresh
Content-Type: application/json
```

Request:

```json
{
  "refreshToken": "<stored-refresh-token>"
}
```

Response: `Auth Response`.

Use refresh while the app is active and the access token expires.

### Unlock

```http
POST /api/v1/auth/unlock
Content-Type: application/json
```

Request:

```json
{
  "refreshToken": "<stored-refresh-token>",
  "pin": "1234"
}
```

Response: `Auth Response`.

Use unlock when the app is reopened and a refresh token exists.

### Logout Current Device

```http
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "refreshToken": "<stored-refresh-token>"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully."
  }
}
```

After logout, clear local access token, refresh token, and cached user state.

### Logout All Devices

```http
POST /api/v1/auth/logout-all
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": {
    "message": "Logged out from all devices."
  }
}
```

After logout-all, clear local session data on the current device.

## User Profile

The user cannot edit:

- name
- date of birth
- country
- currency

These fields will later come from KYC.

### Get Current User

```http
GET /api/v1/users/me
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": {
    "uuid": "f2e5dab0-ea71-4c52-9f3a-eb0a71d6bd0f",
    "email": "user@example.com",
    "phoneNumber": null,
    "paymentTag": "tashuser",
    "status": "active",
    "userTypes": ["consumer"],
    "profile": {
      "firstName": "Tash",
      "lastName": "User",
      "dateOfBirth": "1998-01-01",
      "country": "NG",
      "defaultCurrency": "NGN"
    }
  }
}
```

### Change Payment Tag

Active users can change their payment tag.

```http
PATCH /api/v1/users/me/tag
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "paymentTag": "newtag"
}
```

Response: `Public User Profile` inside the success envelope.

### Resolve Recipient

Recipient resolution must use payment tag only.

```http
GET /api/v1/users/resolve/:paymentTag
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": {
    "uuid": "0cdd1a8a-450d-47a8-8d7a-c4a0d05fa6c2",
    "paymentTag": "receiver",
    "firstName": "Receiver",
    "lastName": "User"
  }
}
```

Do not build recipient resolution by email or phone.

## Wallets

The backend creates a default wallet during onboarding.

### List Wallets

```http
GET /api/v1/wallets
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "walletUuid": "4d41f334-8645-4206-b0af-cd908e68b940",
      "currency": "NGN",
      "availableBalance": 25000,
      "ledgerBalance": 25000,
      "status": "active"
    }
  ]
}
```

### Get Wallet

```http
GET /api/v1/wallets/:walletUuid
Authorization: Bearer <accessToken>
```

Response: `Wallet` inside the success envelope.

### Get Wallet Balance

```http
GET /api/v1/wallets/:walletUuid/balance
Authorization: Bearer <accessToken>
```

Response: `Wallet` inside the success envelope.

### Get Wallet Transactions

```http
GET /api/v1/wallets/:walletUuid/transactions
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "uuid": "6a8d6bc6-1cc1-42a5-ae20-45f75bd28364",
      "reference": "txn_1783400000000",
      "direction": "credit",
      "entryType": "card_funding",
      "amount": 5000,
      "currency": "NGN",
      "balanceBefore": 20000,
      "balanceAfter": 25000,
      "status": "posted",
      "metadata": {},
      "createdAt": "2026-07-07T00:00:00.000Z"
    }
  ]
}
```

### Balance Terms

- `availableBalance`: spendable balance. This is the main balance mobile should show.
- `ledgerBalance`: posted wallet balance.
- `pendingBalance`: held or unsettled funds. This is mostly internal and should not be emphasized unless needed.

## Banks

### List Banks

```http
GET /api/v1/banks
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "name": "GTBank",
      "code": "058",
      "country": "NG",
      "currency": "NGN"
    }
  ]
}
```

### Resolve Bank Account

```http
POST /api/v1/banks/resolve-account
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "bankCode": "058",
  "accountNumber": "0123456789"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "bankCode": "058",
    "accountNumber": "0123456789",
    "accountName": "TASH USER",
    "bankName": "GTBank"
  }
}
```

## Send Money

Use an `Idempotency-Key` header for transfer and funding requests so mobile retries do not duplicate money movement.

### Send to Tash User

Recommended mobile flow:

1. User enters recipient payment tag.
2. Mobile resolves the tag.
3. Show recipient confirmation.
4. User enters amount.
5. User enters transaction PIN.
6. Submit transfer.
7. Show result screen.
8. Refresh wallet balance and transaction list.

Rules:

- Do not allow sending to self.
- Do not allow sending without resolving the payment tag first.
- Do not allow sending to inactive or unresolved users.

```http
POST /api/v1/transfers/tash
Authorization: Bearer <accessToken>
Idempotency-Key: <uuid>
Content-Type: application/json
```

Request:

```json
{
  "recipient": "receiver",
  "walletUuid": "4d41f334-8645-4206-b0af-cd908e68b940",
  "amount": 5000,
  "currency": "NGN",
  "description": "Lunch",
  "transactionPin": "1234"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "reference": "txn_1783400000001",
    "status": "successful",
    "amount": 5000,
    "currency": "NGN",
    "senderWalletUuid": "4d41f334-8645-4206-b0af-cd908e68b940",
    "recipientWalletUuid": "f92e6d41-c465-42a5-8e11-7113321e48a8",
    "recipient": {
      "uuid": "0cdd1a8a-450d-47a8-8d7a-c4a0d05fa6c2",
      "paymentTag": "receiver",
      "firstName": "Receiver",
      "lastName": "User"
    }
  }
}
```

### Bank Transfer

Recommended mobile flow:

1. Fetch/select bank.
2. Enter account number.
3. Resolve account name.
4. Confirm account details and amount.
5. Enter transaction PIN.
6. Submit transfer.
7. Show pending, successful, or failed result.
8. Refresh wallet balance and transaction list.

```http
POST /api/v1/transfers/bank
Authorization: Bearer <accessToken>
Idempotency-Key: <uuid>
Content-Type: application/json
```

Request:

```json
{
  "walletUuid": "4d41f334-8645-4206-b0af-cd908e68b940",
  "bankCode": "058",
  "accountNumber": "0123456789",
  "accountName": "TASH USER",
  "amount": 10000,
  "currency": "NGN",
  "description": "Withdrawal",
  "transactionPin": "1234"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "reference": "txn_1783400000002",
    "status": "pending",
    "amount": 10000,
    "currency": "NGN",
    "walletUuid": "4d41f334-8645-4206-b0af-cd908e68b940",
    "bankCode": "058",
    "accountNumberLastFour": "6789",
    "accountName": "TASH USER"
  }
}
```

### Get Transfer

```http
GET /api/v1/transfers/:reference
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": {
    "reference": "txn_1783400000002",
    "type": "bank_transfer",
    "status": "pending",
    "amount": 10000,
    "currency": "NGN",
    "description": "Withdrawal",
    "createdAt": "2026-07-07T00:00:00.000Z"
  }
}
```

## Cards

Cards are tokenized through the payment provider. The backend stores only safe card token/display details.

Mobile must never store:

- card number
- CVV
- card PIN
- OTP

### Add Card

Create registration session:

```http
POST /api/v1/cards/registration-sessions
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "currency": "NGN"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "reference": "4d41f334-8645-4206-b0af-cd908e68b940",
    "status": "created",
    "authorizationUrl": "https://checkout.provider.example/session",
    "expiresAt": "2026-07-07T00:30:00.000Z",
    "metadata": {
      "currency": "NGN"
    },
    "failureReason": null
  }
}
```

Store `reference` only for the current add-card attempt.

Submit card details:

```http
POST /api/v1/cards/registration-sessions/:reference/card
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "cardNumber": "4111111111111111",
  "expiryMonth": "12",
  "expiryYear": "2030",
  "cvv": "123",
  "cardPin": "1234",
  "cardholderName": "Optional Name"
}
```

Response when OTP is required:

```json
{
  "success": true,
  "data": {
    "reference": "4d41f334-8645-4206-b0af-cd908e68b940",
    "status": "pending",
    "authorizationUrl": "https://checkout.provider.example/session",
    "expiresAt": "2026-07-07T00:30:00.000Z",
    "metadata": {
      "currency": "NGN",
      "transactionId": "provider-transaction-id",
      "nextAction": "submit_otp",
      "cardDetailsSubmittedAt": "2026-07-07T00:00:00.000Z"
    },
    "failureReason": null
  }
}
```

`cardPin` is optional in the API, but the provider may require it for some cards. If the response status is `pending` and metadata contains `nextAction: "submit_otp"`, show the OTP screen.

Submit OTP:

```http
POST /api/v1/cards/registration-sessions/:reference/otp
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "otp": "746119"
}
```

Successful response returns a saved card:

```json
{
  "success": true,
  "data": {
    "uuid": "8df1199a-6b63-4f05-9b7c-2cfe87cfb123",
    "brand": "visa",
    "lastFourDigits": "1111",
    "expiryMonth": "12",
    "expiryYear": "2030",
    "cardholderName": null,
    "bankName": null,
    "country": null,
    "currency": "NGN",
    "isDefault": true,
    "status": "active",
    "lastChargedAt": null,
    "createdAt": "2026-07-07T00:00:00.000Z"
  }
}
```

If the card registration session becomes `failed`, `completed`, or expired, discard the reference and restart add-card from session creation.

### Saved Card Actions

List cards:

```http
GET /api/v1/cards
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "uuid": "8df1199a-6b63-4f05-9b7c-2cfe87cfb123",
      "brand": "visa",
      "lastFourDigits": "1111",
      "expiryMonth": "12",
      "expiryYear": "2030",
      "cardholderName": null,
      "bankName": null,
      "country": null,
      "currency": "NGN",
      "isDefault": true,
      "status": "active",
      "lastChargedAt": null,
      "createdAt": "2026-07-07T00:00:00.000Z"
    }
  ]
}
```

Get card:

```http
GET /api/v1/cards/:uuid
Authorization: Bearer <accessToken>
```

Response: `Card` inside the success envelope.

Set default card:

```http
PATCH /api/v1/cards/:uuid/default
Authorization: Bearer <accessToken>
```

Response: updated `Card` inside the success envelope.

Disable card:

```http
POST /api/v1/cards/:uuid/disable
Authorization: Bearer <accessToken>
```

Response: updated `Card` inside the success envelope.

Delete/revoke card:

```http
DELETE /api/v1/cards/:uuid
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

## Fund Wallet with Card

```http
POST /api/v1/wallets/:walletUuid/fund/card
Authorization: Bearer <accessToken>
Idempotency-Key: <uuid>
Content-Type: application/json
```

Request:

```json
{
  "cardUuid": "8df1199a-6b63-4f05-9b7c-2cfe87cfb123",
  "amount": 5000,
  "currency": "NGN",
  "transactionPin": "1234"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "reference": "txn_1783400000003",
    "status": "successful",
    "amount": 5000,
    "currency": "NGN",
    "walletUuid": "4d41f334-8645-4206-b0af-cd908e68b940",
    "cardUuid": "8df1199a-6b63-4f05-9b7c-2cfe87cfb123"
  }
}
```

After success:

- show receipt/details
- refresh wallet balance
- refresh wallet transactions

## Direct Debit

Recommended mobile flow:

1. User starts direct debit mandate setup.
2. User enters bank/account details and maximum amount.
3. Backend creates mandate.
4. User completes provider authorization if required.
5. Mandate becomes active.
6. Active mandate can be used to fund wallet.

Mobile should support these mandate states:

- `pending`
- `requires_authorization`
- `active`
- `failed`
- `expired`
- `revoked`

Only active mandates should be selectable for wallet funding.

### Create Mandate

```http
POST /api/v1/direct-debit/mandates
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "bankCode": "058",
  "accountNumber": "0123456789",
  "accountName": "TASH USER",
  "maximumAmount": 50000,
  "currency": "NGN"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "uuid": "0aa7b444-9f9f-4a47-bd12-f76370145c91",
    "provider": "nomba",
    "bankName": "GTBank",
    "accountName": "TASH USER",
    "accountNumberLastFour": "6789",
    "bankCode": "058",
    "currency": "NGN",
    "maximumAmount": 50000,
    "status": "requires_authorization",
    "authorizedAt": null,
    "expiresAt": null,
    "revokedAt": null,
    "failureReason": null,
    "createdAt": "2026-07-07T00:00:00.000Z"
  }
}
```

### List Mandates

```http
GET /api/v1/direct-debit/mandates
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "uuid": "0aa7b444-9f9f-4a47-bd12-f76370145c91",
      "provider": "nomba",
      "bankName": "GTBank",
      "accountName": "TASH USER",
      "accountNumberLastFour": "6789",
      "bankCode": "058",
      "currency": "NGN",
      "maximumAmount": 50000,
      "status": "active",
      "authorizedAt": "2026-07-07T00:00:00.000Z",
      "expiresAt": null,
      "revokedAt": null,
      "failureReason": null,
      "createdAt": "2026-07-07T00:00:00.000Z"
    }
  ]
}
```

### Get Mandate

```http
GET /api/v1/direct-debit/mandates/:uuid
Authorization: Bearer <accessToken>
```

Response: direct debit mandate object inside the success envelope.

### Authorize Mandate

```http
POST /api/v1/direct-debit/mandates/:uuid/authorize
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "authorizationReference": "provider-authorization-reference"
}
```

Response: updated direct debit mandate object inside the success envelope.

### Revoke Mandate

```http
POST /api/v1/direct-debit/mandates/:uuid/revoke
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "reason": "User disabled mandate"
}
```

Response: updated direct debit mandate object inside the success envelope.

### Fund Wallet with Direct Debit

```http
POST /api/v1/wallets/:walletUuid/fund/direct-debit
Authorization: Bearer <accessToken>
Idempotency-Key: <uuid>
Content-Type: application/json
```

Request:

```json
{
  "mandateUuid": "0aa7b444-9f9f-4a47-bd12-f76370145c91",
  "amount": 5000,
  "currency": "NGN",
  "transactionPin": "1234"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "reference": "txn_1783400000004",
    "status": "pending",
    "amount": 5000,
    "currency": "NGN",
    "walletUuid": "4d41f334-8645-4206-b0af-cd908e68b940",
    "mandateUuid": "0aa7b444-9f9f-4a47-bd12-f76370145c91"
  }
}
```

## Settings

Settings should include:

- default wallet
- default card
- default direct debit mandate
- notification preferences
- transaction PIN update

Transaction PIN is created during onboarding. Settings can support updating the PIN.

No password-based PIN reset should be shown.

If the default card is disabled or deleted, the backend clears it automatically.

### Get Payment Settings

```http
GET /api/v1/settings/payment
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": {
    "defaultCardId": 12,
    "defaultDirectDebitMandateId": null,
    "defaultWalletId": 3,
    "requireTransactionPin": true,
    "allowCardPayments": true,
    "allowDirectDebitPayments": true,
    "allowWalletPayments": true,
    "allowMerchantPayments": true,
    "dailyTransferLimit": 1000000,
    "dailyPaymentLimit": 1000000,
    "singleTransactionLimit": 500000,
    "notificationPreferences": {}
  }
}
```

### Update Payment Settings

```http
PATCH /api/v1/settings/payment
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "defaultCardId": 12,
  "defaultDirectDebitMandateId": null,
  "defaultWalletId": 3,
  "allowCardPayments": true,
  "allowDirectDebitPayments": true,
  "singleTransactionLimit": 500000,
  "notificationPreferences": {
    "push": true,
    "email": true
  }
}
```

Response: payment settings object inside the success envelope.

### Create Transaction PIN Fallback

Transaction PIN is normally created during onboarding. This endpoint is only a fallback/backfill path.

```http
POST /api/v1/settings/transaction-pin
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "pin": "1234"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "message": "Transaction PIN created successfully."
  }
}
```

### Update Transaction PIN

```http
PATCH /api/v1/settings/transaction-pin
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "currentPin": "1234",
  "newPin": "5678"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "message": "Transaction PIN updated successfully."
  }
}
```

## Global Error Handling

The app should handle these globally:

- `401`: access token expired or invalid. Try refresh or unlock.
- refresh token expired: clear session and send user to login.
- `CARD_REGISTRATION_FAILED`: restart card flow if the session failed, completed, or expired.
- `INVALID_TRANSACTION_PIN`: show PIN error.
- `TRANSACTION_PIN_LOCKED`: disable PIN attempts until the lock expires.
- `INSUFFICIENT_WALLET_BALANCE`: show balance error.
- provider failures: show a clean user message and allow retry.

### Common Error Examples

Validation failure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed.",
    "details": ["email must be an email"]
  },
  "requestId": "req_00000000-0000-0000-0000-000000000000"
}
```

Invalid transaction PIN:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TRANSACTION_PIN",
    "message": "Invalid transaction PIN.",
    "details": null
  },
  "requestId": "req_00000000-0000-0000-0000-000000000000"
}
```

Provider failure:

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_UNAVAILABLE",
    "message": "Payment provider request failed.",
    "details": {}
  },
  "requestId": "req_00000000-0000-0000-0000-000000000000"
}
```

Card registration failure:

```json
{
  "success": false,
  "error": {
    "code": "CARD_REGISTRATION_FAILED",
    "message": "Card registration session cannot proceed from failed.",
    "details": null
  },
  "requestId": "req_00000000-0000-0000-0000-000000000000"
}
```

## Recommended Screens

- Auth choice
- OTP verification
- Onboarding profile
- Claim payment tag
- Create transaction PIN
- Unlock PIN
- Home/dashboard
- Wallet details
- Transaction history
- Send to payment tag
- Bank transfer
- Add card
- Cards list
- Direct debit mandates
- Fund wallet
- Settings
- Profile view

## Mobile Security Checklist

- Store refresh token only in secure storage.
- Keep access token short-lived and clear it on logout.
- Never persist raw card details.
- Never persist CVV.
- Never persist card PIN.
- Never persist transaction PIN.
- Never persist OTP.
- Never log auth headers.
- Never log payment provider payloads containing sensitive inputs.
- Clear sensitive form fields after submission.
- Treat card registration references as temporary state.
- Restart card registration after failed, expired, or completed sessions.
