# AgentPay Solana — The Payment Layer for AI Agents

> Mobile-first dashboard letting humans govern AI agent spending in real-time. Built for the Solana Seeker phone.

**Live:** [agentpay-solana.vercel.app](https://agentpay-solana.vercel.app)

## 🎬 Demo

**Demo Video:** [AgentPay Animation](https://cdn.muapi.ai/outputs/0bf67131c36b44838bb09aac61def522.mp4)

**Video Walkthrough:** [Screen recording on Seeker phone](https://cdn.muapi.ai/outputs/seeker_agentpay_final.mp4) *(no audio — Loom with narration coming soon)*

### Screenshots

| Landing / Hero | Dashboard | Payment Approved |
|----------------|-----------|-----------------|
| ![Hero](https://raw.githubusercontent.com/FranklinIV94/agentpay-solana/master/app/public/demo_screens/agentpay_hero.png) | ![Mobile](https://raw.githubusercontent.com/FranklinIV94/agentpay-solana/master/app/public/demo_screens/agentpay_mobile.png) | ![Approved](https://raw.githubusercontent.com/FranklinIV94/agentpay-solana/master/app/public/demo_screens/agentpay_approved.png) |

## ⛓️ How We Use Solana

1. **Anchor Smart Contract** — 8 on-chain instructions deployed on Solana Devnet. The program manages agent wallets, payment requests, escrow, and spending limits entirely on-chain using Program-Derived Addresses (PDAs).
2. **Escrow Model** — When an agent calls `request_payment`, SOL is locked in the agent's PDA account. The owner must call `approve_payment` or `reject_payment` to release funds. No agent can spend without human confirmation.
3. **Variable-Cost Capture** — For operations with uncertain costs (e.g., LLM inference), `reserve_credit` locks the maximum amount. After the operation completes, `capture_payment` settles the actual cost and refunds the difference. Agents can't overcharge.
4. **Spending Limits** — Each agent wallet has `dailyLimitSol` and `perTxLimitSol` enforced at the program level. Even if an agent goes rogue, it can't exceed its cap.
5. **Payment Flow:** Agent calls `request_payment` → SOL escrowed in PDA → Owner gets notification → One tap `approve_payment` → SOL transferred to recipient → Confirmed in <400ms.
6. **Seeker Integration** — The mobile UI is optimized for Solana's Seeker phone with direct keypair integration (no wallet adapter needed). Demo auto-generates a keypair and airdrops devnet SOL.


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