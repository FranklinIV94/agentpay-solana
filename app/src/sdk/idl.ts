/**
 * AgentPay IDL — Auto-generated from Anchor build
 * Program: D5yYFh3JDSKoKNGv6s4EDga4Ste7JPbyAS4GKuGuiQG7
 */
export const AgentpayIDL = {
  address: "D5yYFh3JDSKoKNGv6s4EDga4Ste7JPbyAS4GKuGuiQG7",
  metadata: {
    name: "agentpay",
    version: "0.1.0",
    spec: "0.1.0",
    description: "AgentPay — Mobile-first AI Agent Payment Manager on Solana",
  },
  instructions: [
    {
      name: "create_agent_wallet",
      accounts: [
        { name: "owner", writable: true, signer: true },
        { name: "agent_wallet", writable: true },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "agent_name", type: "string" },
        { name: "daily_limit", type: "u64" },
        { name: "per_tx_limit", type: "u64" },
      ],
    },
    {
      name: "request_payment",
      accounts: [
        { name: "agent", writable: true, signer: true },
        { name: "agent_wallet", writable: true },
        { name: "payment_request", writable: true },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "amount", type: "u64" },
        { name: "recipient", type: "pubkey" },
        { name: "reason", type: "string" },
      ],
    },
    {
      name: "approve_payment",
      accounts: [
        { name: "owner", writable: true, signer: true },
        { name: "agent_wallet", writable: true },
        { name: "payment_request", writable: true },
        { name: "recipient", writable: true },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [],
    },
    {
      name: "reject_payment",
      accounts: [
        { name: "owner", signer: true },
        { name: "agent_wallet", writable: true },
        { name: "payment_request", writable: true },
      ],
      args: [],
    },
    {
      name: "reserve_credit",
      accounts: [
        { name: "agent", writable: true, signer: true },
        { name: "agent_wallet", writable: true },
        { name: "reservation", writable: true },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "max_amount", type: "u64" },
        { name: "reason", type: "string" },
      ],
    },
    {
      name: "capture_payment",
      accounts: [
        { name: "owner", writable: true, signer: true },
        { name: "agent_wallet", writable: true },
        { name: "reservation", writable: true },
        { name: "recipient", writable: true },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "actual_amount", type: "u64" }],
    },
    {
      name: "update_spending_limit",
      accounts: [
        { name: "owner", signer: true },
        { name: "agent_wallet", writable: true },
      ],
      args: [
        { name: "daily_limit", type: "u64" },
        { name: "per_tx_limit", type: "u64" },
      ],
    },
    {
      name: "stake_skr",
      accounts: [
        { name: "owner", signer: true },
        { name: "agent_wallet", writable: true },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
  ],
  accounts: [
    { name: "AgentWallet" },
    { name: "CreditReservation" },
    { name: "PaymentRequest" },
  ],
  errors: [
    { code: 6000, name: "AgentInactive", msg: "Agent wallet is inactive" },
    { code: 6001, name: "ExceedsPerTxLimit", msg: "Payment amount exceeds per-transaction limit" },
    { code: 6002, name: "ExceedsDailyLimit", msg: "Payment would exceed daily spending limit" },
    { code: 6003, name: "PaymentNotPending", msg: "Payment is not in pending status" },
    { code: 6004, name: "NotOwner", msg: "Only the wallet owner can perform this action" },
    { code: 6005, name: "ReservationNotActive", msg: "Reservation is not active" },
    { code: 6006, name: "ExceedsReservation", msg: "Captured amount exceeds reservation max" },
  ],
  types: [
    {
      name: "AgentWallet",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "agent_name", type: "string" },
          { name: "daily_limit", type: "u64" },
          { name: "per_tx_limit", type: "u64" },
          { name: "daily_spent", type: "u64" },
          { name: "last_reset", type: "i64" },
          { name: "is_active", type: "bool" },
          { name: "skr_staked", type: "u64" },
          { name: "total_approved", type: "u64" },
          { name: "total_rejected", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "CreditReservation",
      type: {
        kind: "struct",
        fields: [
          { name: "agent_wallet", type: "pubkey" },
          { name: "max_amount", type: "u64" },
          { name: "captured_amount", type: "u64" },
          { name: "reason", type: "string" },
          { name: "status", type: { defined: { name: "ReservationStatus" } } },
          { name: "created_at", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "PaymentRequest",
      type: {
        kind: "struct",
        fields: [
          { name: "agent_wallet", type: "pubkey" },
          { name: "amount", type: "u64" },
          { name: "recipient", type: "pubkey" },
          { name: "reason", type: "string" },
          { name: "status", type: { defined: { name: "PaymentStatus" } } },
          { name: "created_at", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "PaymentStatus",
      type: { kind: "enum", variants: ["Pending", "Approved", "Rejected", "Expired"] },
    },
    {
      name: "ReservationStatus",
      type: { kind: "enum", variants: ["Active", "Captured", "Released", "Expired"] },
    },
  ],
};