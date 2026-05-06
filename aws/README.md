# AgentPay AWS Infrastructure

Off-chain indexing and API for AgentPay Solana. Powers the leaderboard, analytics, and push notifications.

## Architecture

```
Solana Devnet/Mainnet
        │
        ▼
  Helius Webhook ──► API Gateway ──► Lambda (indexer)
        │                                    │
        │                                    ▼
        │                            DynamoDB (payments, wallets)
        │                                    │
        ▼                                    ▼
  Mobile Wallet Adapter ◄───────── API Gateway ──► Lambda (API)
        │                                    │
        ▼                                    ▼
  Seeker Phone ◄──────────── Push Notifications (FCM/APNS)
```

## Components

- **indexer/** — Lambda function that processes on-chain events via Helius webhooks
- **api/** — REST API for mobile app to fetch pending payments, leaderboard, analytics
- **infrastructure/** — CDK stack for provisioning all AWS resources

## API Endpoints

### GET /v1/wallets/{address}/agents
List all agent wallets for an owner

### GET /v1/wallets/{address}/payments/pending
Get pending payment requests requiring approval

### POST /v1/wallets/{address}/agents
Create a new agent wallet (delegates to on-chain program)

### GET /v1/leaderboard
Top agent operators by transaction volume

### GET /v1/wallets/{address}/analytics
Spending analytics, daily usage, SKR benefits