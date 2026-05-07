/**
 * AgentPay SDK — TypeScript client for AI agents to request payments on Solana
 * Production version with real Anchor IDL integration
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { AgentpayIDL } from "./idl";

export const AGENTPAY_PROGRAM_ID = new PublicKey(
  "D5yYFh3JDSKoKNGv6s4EDga4Ste7JPbyAS4GKuGuiQG7"
);

// ─── PDA Helpers ─────────────────────────────────────────────────────

export function findAgentWalletPda(
  owner: PublicKey,
  agentName: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("agent_wallet"),
      owner.toBuffer(),
      Buffer.from(agentName),
    ],
    AGENTPAY_PROGRAM_ID
  );
}

export function findPaymentRequestPda(
  agentWallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("payment_request"), agentWallet.toBuffer()],
    AGENTPAY_PROGRAM_ID
  );
}

export function findReservationPda(
  agentWallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("reservation"), agentWallet.toBuffer()],
    AGENTPAY_PROGRAM_ID
  );
}

// ─── Types ────────────────────────────────────────────────────────────

export interface AgentWalletAccount {
  owner: PublicKey;
  agentName: string;
  dailyLimit: BN;
  perTxLimit: BN;
  dailySpent: BN;
  lastReset: BN;
  isActive: boolean;
  skrStaked: BN;
  totalApproved: BN;
  totalRejected: BN;
  bump: number;
}

export interface PaymentRequestAccount {
  agentWallet: PublicKey;
  amount: BN;
  recipient: PublicKey;
  reason: string;
  status: { pending: {} } | { approved: {} } | { rejected: {} } | { expired: {} };
  createdAt: BN;
  bump: number;
}

export interface CreditReservationAccount {
  agentWallet: PublicKey;
  maxAmount: BN;
  capturedAmount: BN;
  reason: string;
  status: { active: {} } | { captured: {} } | { released: {} } | { expired: {} };
  createdAt: BN;
  bump: number;
}

export interface CreateAgentWalletParams {
  agentName: string;
  dailyLimitSol: number;
  perTxLimitSol: number;
}

export interface RequestPaymentParams {
  agentWallet: PublicKey;
  amountSol: number;
  recipient: PublicKey;
  reason: string;
}

export interface ReserveCreditParams {
  agentWallet: PublicKey;
  maxAmountSol: number;
  reason: string;
}

// ─── Client ───────────────────────────────────────────────────────────

export class AgentPayClient {
  private program: Program;
  private connection: Connection;

  constructor(connection: Connection, programId?: PublicKey) {
    const idl = AgentpayIDL as Idl;
    // Create a read-only provider (no wallet needed for reads)
    const provider = new AnchorProvider(
      connection,
      // @ts-ignore - read-only provider doesn't need real wallet for fetching
      { publicKey: PublicKey.unique(), signTransaction: async (tx) => tx },
      { commitment: "confirmed" }
    );
    this.connection = connection;
    this.program = new Program(idl, programId || AGENTPAY_PROGRAM_ID, provider);
  }

  // ─── Read Methods ────────────────────────────────────────────────

  async getAgentWallet(agentWalletAddress: PublicKey): Promise<AgentWalletAccount | null> {
    try {
      const account = await this.program.account.agentWallet.fetch(agentWalletAddress);
      return account as unknown as AgentWalletAccount;
    } catch {
      return null;
    }
  }

  async getPaymentRequest(paymentRequestAddress: PublicKey): Promise<PaymentRequestAccount | null> {
    try {
      const account = await this.program.account.paymentRequest.fetch(paymentRequestAddress);
      return account as unknown as PaymentRequestAccount;
    } catch {
      return null;
    }
  }

  async getReservation(reservationAddress: PublicKey): Promise<CreditReservationAccount | null> {
    try {
      const account = await this.program.account.creditReservation.fetch(reservationAddress);
      return account as unknown as CreditReservationAccount;
    } catch {
      return null;
    }
  }

  async getAllAgentWallets(owner: PublicKey): Promise<PublicKey[]> {
    return await this.program.account.agentWallet.all([
      { memcmp: { offset: 8, bytes: owner.toBase58() } },
    ]);
  }

  async getAllPendingPayments(agentWallet: PublicKey): Promise<PublicKey[]> {
    return await this.program.account.paymentRequest.all([
      { memcmp: { offset: 8, bytes: agentWallet.toBase58() } },
    ]);
  }

  // ─── Transaction Builders (for wallet-adapter) ──────────────────

  /**
   * Create a new agent wallet with spending limits
   * Must be signed by the owner
   */
  createAgentWalletIx(
    owner: PublicKey,
    params: CreateAgentWalletParams
  ): TransactionInstruction {
    const [agentWallet] = findAgentWalletPda(owner, params.agentName);
    return this.program.methods
      .createAgentWallet(
        params.agentName,
        new BN(params.dailyLimitSol * LAMPORTS_PER_SOL),
        new BN(params.perTxLimitSol * LAMPORTS_PER_SOL)
      )
      .accounts({
        owner,
        agentWallet,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  /**
   * Agent requests a payment (goes to pending approval queue)
   * Must be signed by the agent
   */
  requestPaymentIx(
    agent: PublicKey,
    params: RequestPaymentParams
  ): TransactionInstruction {
    const [paymentRequest] = findPaymentRequestPda(params.agentWallet);
    return this.program.methods
      .requestPayment(
        new BN(params.amountSol * LAMPORTS_PER_SOL),
        params.recipient,
        params.reason
      )
      .accounts({
        agent,
        agentWallet: params.agentWallet,
        paymentRequest,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  /**
   * Owner approves a pending payment from Seeker phone
   * Must be signed by the owner
   */
  approvePaymentIx(
    owner: PublicKey,
    agentWallet: PublicKey,
    paymentRequest: PublicKey,
    recipient: PublicKey
  ): TransactionInstruction {
    return this.program.methods
      .approvePayment()
      .accounts({
        owner,
        agentWallet,
        paymentRequest,
        recipient,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  /**
   * Owner rejects a pending payment
   * Must be signed by the owner
   */
  rejectPaymentIx(
    owner: PublicKey,
    agentWallet: PublicKey,
    paymentRequest: PublicKey
  ): TransactionInstruction {
    return this.program.methods
      .rejectPayment()
      .accounts({
        owner,
        agentWallet,
        paymentRequest,
      })
      .instruction();
  }

  /**
   * Reserve credit for variable-cost operations (e.g., LLM inference)
   * Must be signed by the agent
   */
  reserveCreditIx(
    agent: PublicKey,
    agentWallet: PublicKey,
    params: ReserveCreditParams
  ): TransactionInstruction {
    const [reservation] = findReservationPda(agentWallet);
    return this.program.methods
      .reserveCredit(
        new BN(params.maxAmountSol * LAMPORTS_PER_SOL),
        params.reason
      )
      .accounts({
        agent,
        agentWallet,
        reservation,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  /**
   * Capture actual amount after variable-cost operation completes
   * Must be signed by the owner
   */
  capturePaymentIx(
    owner: PublicKey,
    agentWallet: PublicKey,
    reservation: PublicKey,
    recipient: PublicKey,
    actualAmountSol: number
  ): TransactionInstruction {
    return this.program.methods
      .capturePayment(new BN(actualAmountSol * LAMPORTS_PER_SOL))
      .accounts({
        owner,
        agentWallet,
        reservation,
        recipient,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  /**
   * Update spending limits for an agent
   * Must be signed by the owner
   */
  updateSpendingLimitIx(
    owner: PublicKey,
    agentWallet: PublicKey,
    dailyLimitSol: number,
    perTxLimitSol: number
  ): TransactionInstruction {
    return this.program.methods
      .updateSpendingLimit(
        new BN(dailyLimitSol * LAMPORTS_PER_SOL),
        new BN(perTxLimitSol * LAMPORTS_PER_SOL)
      )
      .accounts({
        owner,
        agentWallet,
      })
      .instruction();
  }

  /**
   * Stake SKR tokens for premium features (2x limits, analytics)
   * Must be signed by the owner
   */
  stakeSkrIx(
    owner: PublicKey,
    agentWallet: PublicKey,
    amount: number
  ): TransactionInstruction {
    return this.program.methods
      .stakeSkr(new BN(amount))
      .accounts({
        owner,
        agentWallet,
      })
      .instruction();
  }
}