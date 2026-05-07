# AgentPay Solana — The Payment Layer for AI Agents

> Mobile-first dashboard letting humans govern AI agent spending in real-time. Built for the Solana Seeker phone.

**Live:** [agentpay-solana.vercel.app](https://agentpay-solana.vercel.app)

## Overview

AI agents are spending money — API calls, compute, data — with no mobile control. No approval flow. No spending limits. AgentPay fixes that.

Your Seeker phone becomes the command center for AI commerce. Agents request payments, humans approve or reject with one tap, and Solana settles in <400ms.

Built for the **Solana Seeker Track** at Consensus 2026 Miami.

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  AI Agent     │────▶│  Solana       │────▶│  Seeker Phone │
│  Requests $   │     │  Anchor Prog  │     │  Approve/Reject│
└──────────────┘     └──────────────┘     └──────────────┘
                            │                      │
                     Escrow + Limits         One-tap UI
                     On-chain rules          Real-time alerts
```

1. **Agent requests payment** — AI agent submits tx on-chain
2. **Human gets alert** — Seeker phone notification
3. **One tap approve/reject** — Instant on-chain settlement
4. **Settled** — Solana finality in <400ms

## Core Smart Contract Operations

| Instruction | Description |
|-------------|-------------|
| `create_agent_wallet` | Initialize agent with spending limit |
| `request_payment` | Agent submits payment request (amount, recipient, reason) |
| `approve_payment` | Owner taps approve on phone |
| `reject_payment` | Owner rejects, funds stay in escrow |
| `reserve_credit` | Lock funds for variable-cost operation |
| `capture_payment` | Settle exact amount after operation completes |
| `update_spending_limit` | Adjust agent's max spend |
| `stake_skr` | Stake SKR tokens for premium features |

## Tech Stack

- **Smart Contracts:** Anchor (Rust) on Solana
- **Frontend:** Next.js 14 + React 18 + Framer Motion
- **Wallet:** Direct keypair (no adapter needed for Seeker)
- **AI:** DeepSeek for generating payment requests
- **Backend:** AWS Lambda for off-chain processing

## Features

- **One-tap approval** — Agent requests → push notification → tap approve → Solana settles
- **Spending limits per agent** — Agents can't burn your wallet
- **Escrow & variable-cost capture** — Reserve funds, settle exact amount after inference
- **SKR token staking** — Stake for higher limits and premium analytics
- **Leaderboard** — Most active operators, most trusted agents
- **Cross-chain x402 bridge** — AI agents on Base pay via x402, human approves on Solana

## Quick Start

```bash
# Install dependencies
cd app && npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app generates a demo keypair automatically.

## Project Structure

```
agentpay-solana/
├── programs/
│   └── agentpay/
│       └── src/lib.rs       # Anchor smart contract
├── app/
│   ├── src/
│   │   ├── pages/index.tsx  # Main dashboard (landing + app)
│   │   ├── pages/api/       # API routes
│   │   ├── hooks/           # Solana hooks
│   │   ├── sdk/             # Agent payment client SDK
│   │   └── styles/          # Global CSS + animations
│   └── public/demo_screens/ # Demo screenshots
├── sdk/                      # TypeScript SDK for agents
├── aws/                      # Lambda + CDK infrastructure
└── tests/                    # Integration tests
```

## Consensus 2026

This project was built for Consensus 2026 Miami.

**Submission:** [consensus-submission.vercel.app](https://consensus-submission.vercel.app)  
**Paired with:** [Agent Studio](https://agent-studio-fawn.vercel.app) — AI agent pipeline on Base

## License

MIT