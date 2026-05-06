# AgentPay Solana — Hackathon Build Log

## Project: AgentPay — Mobile-First AI Agent Payment Manager on Solana

**Tracks:** Seeker Mobile dApp + AWS Cloud Infrastructure

### What We're Building
AI agents need a mobile control layer. AgentPay lets Seeker phone owners approve, reject, and manage agent spending on Solana — one tap, instant settlement.

### Architecture
- **On-chain:** Anchor smart contracts (escrow, spending limits, variable-cost capture, SKR staking)
- **Mobile:** Next.js dApp with Solana Mobile Wallet Adapter (Android APK)
- **Off-chain:** AWS Lambda + API Gateway + DynamoDB (indexing, leaderboard, push notifications)
- **Indexing:** Helius webhooks → Lambda → DynamoDB

### Build Status
- [x] Anchor smart contract — escrow, payment flow, reserve/capture, SKR staking
- [x] Mobile dApp UI — wallet connect, pending approvals, dashboard, leaderboard placeholder
- [x] TypeScript SDK — agent payment client
- [x] AWS Lambda indexer — Helius webhook processing
- [x] AWS Lambda API — REST endpoints for mobile app
- [x] CDK infrastructure — DynamoDB tables, API Gateway, Lambda, SNS
- [x] Deploy frontend to Vercel — https://agentpay-solana.vercel.app
- [x] AWS x402 strategic brief — mapped to reference architecture
- [x] Anchor program BUILDS successfully (cargo-build-sbf)
- [x] Program DEPLOYED to Solana devnet (May 6)
- [x] Program ID: D5yYFh3JDSKoKNGv6s4EDga4Ste7JPbyAS4GKuGuiQG7
- [x] SDK rewritten with real Anchor IDL instruction discriminators
- [x] Mobile Wallet Adapter integrated (SolanaMobileWalletAdapter)
- [x] MWA doesn't work in Chrome on Seeker → switched to direct Keypair wallet
- [x] Direct Keypair wallet (localStorage) — no adapter dependency
- [x] Devnet airdrop button for instant demo start
- [x] Simulated LLM agent payment requests (every 8-15s)
- [x] Daily spend bar updates live on approve/reject
- [x] Agent approval/rejection counts update in real-time
- [x] Balance decrements on approval
- [x] Presentation written (PRESENTATION.md)
- [ ] Verify create_agent_wallet works on Seeker devnet
- [ ] Test on-chain transactions end-to-end
- [ ] Wire in free LLM model for real AI agent calls
- [ ] Helius webhook integration
- [ ] Push notifications (FCM/APNS)
- [ ] Cross-chain demo: Agent Studio (Base/x402) → AgentPay (Solana)
- [ ] AWS CDK deployment
- [ ] Record demo video

### Key Decisions
- Reserve + capture pattern from our Stellar build — adapted for Solana Anchor
- SKR staking gives 2x spending limit multiplier ( incentivizes holding)
- Mobile-first design — one-tap approve/reject is the core UX
- AWS track covers indexing, analytics, and notification layer
### Devnet SOL Methods (NOT the web faucet)
- `solana airdrop 2 <WALLET> --url devnet` (CLI)
- `cargo install devnet-pow && devnet-pow mine -d 3 --reward 0.02 --no-infer -t 5000000000` (PoW faucet)
- `solana-test-validator && solana airdrop 100 <WALLET> --url localhost` (local, unlimited)
- Web faucet works but explicitly says AI agents should NOT use it

### May 6 — Hackathon Day 2 Progress

**✅ DONE:**
- SDK rewritten with real Anchor IDL discriminators (all 8 instructions)
- useAgentPay hook rewritten with proper transaction building + confirmation
- Dashboard rewritten with on-chain mode detection + demo fallback
- Mobile Wallet Adapter (SolanaMobileWalletAdapter) integrated in _app.tsx
- Program compiled with cargo-build-sbf and deployed to devnet
- Program ID: D5yYFh3JDSKoKNGv6s4EDga4Ste7JPbyAS4GKuGuiQG7
- Deploy tx: 57pd24H8YF8a4AS5fE2nFwjxbZr59vUukGrAdSXoNcwtSU8UGXarYnmUsMsF9uEViRuk4nZbespTukyhoMqLTHeY
- Frontend deployed to agentpay-solana.vercel.app (with mobile wallet adapter)
- Seeker phone connected via ADB (USB, device SM02G4061995866)
- 2.5 SOL airdropped to wallet

**🔄 IN PROGRESS:**
- Mobile wallet connect button — just deployed fix, testing on Seeker
- Need to verify program works end-to-end on devnet

**📋 TODO:**
- Test create_agent_wallet on Seeker
- Test approve/reject payment flow
- Wire up Helius webhooks for real-time updates
- AWS CDK deployment
- Push notifications
- Cross-chain demo (Agent Studio Base/x402 → AgentPay Solana)
