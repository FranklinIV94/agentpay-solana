# AgentPay Solana — Mobile-First Agent Payment Manager

**The payment layer for AI agents on Solana. Built for Seeker.**

AI agents are spending money — API calls, compute, data — with no mobile control. No approval flow. No spending limits. AgentPay fixes that.

Your Seeker phone becomes the command center for AI commerce.

## Features

- **One-tap approval** — Agent requests payment → push notification → tap approve → Solana settles
- **Spending limits per agent** — agents can't burn your wallet
- **Escrow & variable-cost capture** — reserve funds, settle exact amount after inference completes
- **SKR token integration** — stake for higher limits, earn rewards for on-time approvals
- **Leaderboard** — most active operators, most trusted agents, biggest spenders
- **Seeker-only analytics** — premium dashboards gated to Seeker owners
- **Mobile Wallet Adapter** — native Solana wallet connectivity

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Seeker Phone   │     │  Solana (Devnet) │     │  AI Agent       │
│  AgentPay dApp  │◄────┤  Anchor Program  │◄────┤  Payment Client │
│  (Next.js APK)  │     │  Escrow + Limits │     │  (TypeScript)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Tracks

- **Seeker Track** — Mobile dApp for Solana's Seeker phone
- **AWS Track** — TBD (cloud infra for agent payment processing)

## Tech Stack

- **Smart Contracts:** Anchor (Rust) on Solana
- **Mobile dApp:** Next.js 14 + React Native (Android APK)
- **Wallet:** Mobile Wallet Adapter
- **Payments:** Solana Pay
- **Backend:** AWS (Lambda, DynamoDB, API Gateway) for off-chain indexing
- **Agent SDK:** TypeScript client for agents to request payments

## Quick Start

```bash
# Install Anchor
avm install latest
avm use latest

# Build program
anchor build

# Test
anchor test

# Run dev server
cd app && npm run dev
```

## Project Structure

```
agentpay-solana/
├── programs/
│   └── agentpay/
│       └── src/
│           └── lib.rs          # Anchor smart contract
├── app/
│   ├── src/
│   │   ├── components/         # React Native components
│   │   ├── pages/              # App screens
│   │   ├── hooks/              # Mobile Wallet Adapter hooks
│   │   └── utils/              # Solana helpers
│   └── android/                # APK build config
├── sdk/
│   └── src/
│       └── index.ts            # Agent payment client SDK
├── aws/
│   ├── lambda/                 # Off-chain indexing functions
│   └── infrastructure/         # CDK/Terraform
├── tests/
│   └── agentpay.ts             # Integration tests
├── Anchor.toml
└── package.json
```

## Core Smart Contract Operations

1. **create_agent_wallet** — Initialize agent with spending limit
2. **request_payment** — Agent submits payment request (amount, recipient, reason)
3. **approve_payment** — Owner taps approve on phone
4. **reject_payment** — Owner rejects, funds stay in escrow
5. **reserve_credit** — Lock funds for variable-cost operation
6. **capture_payment** — Settle exact amount after operation completes
7. **update_spending_limit** — Adjust agent's max spend
8. **stake_skr** — Stake SKR tokens for premium features

## License

MIT

---

Built by **Franklin Bryant IV** — [Prospyr Inc](https://simplifyingbusinesses.com) / All Lines Business Solutions