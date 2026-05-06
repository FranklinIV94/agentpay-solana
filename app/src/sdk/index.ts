/**
 * AgentPay SDK — TypeScript client for AI agents to request payments on Solana
 * Production version with Anchor IDL integration for transaction building
 * Uses direct RPC for account reads (avoids Anchor type inference issues)
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
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

// ─── Instruction Discriminators (from Anchor IDL build) ──────────────
const DISCRIMINATORS: Record<string, number[]> = {
  create_agent_wallet: [243, 173, 1, 184, 209, 14, 51, 108],
  request_payment: [200, 214, 181, 94, 178, 84, 71, 247],
  approve_payment: [21, 123, 195, 139, 107, 141, 34, 187],
  reject_payment: [199, 215, 82, 136, 197, 236, 68, 26],
  reserve_credit: [224, 73, 122, 69, 99, 230, 91, 11],
  capture_payment: [34, 107, 72, 107, 184, 7, 4, 64],
  update_spending_limit: [52, 197, 101, 229, 64, 88, 84, 131],
  stake_skr: [1, 218, 232, 36, 151, 113, 160, 26],
};

function getDiscriminator(instructionName: string): Buffer {
  const disc = DISCRIMINATORS[instructionName];
  if (!disc) {
    throw new Error(`Instruction ${instructionName} not found`);
  }
  return Buffer.from(disc);
}

// ─── Types ────────────────────────────────────────────────────────────

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
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // ─── Read Methods (direct RPC) ───────────────────────────────────

  async getAccountData(address: PublicKey): Promise<any | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(address);
      if (!accountInfo) return null;
      return accountInfo;
    } catch {
      return null;
    }
  }

  async accountExists(address: PublicKey): Promise<boolean> {
    const info = await this.connection.getAccountInfo(address);
    return info !== null;
  }

  getConnection(): Connection {
    return this.connection;
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

    // Encode instruction data: discriminator + agent_name (string) + daily_limit (u64) + per_tx_limit (u64)
    const agentNameBuffer = Buffer.from(params.agentName);
    const nameLenBuffer = Buffer.alloc(4);
    nameLenBuffer.writeUInt32LE(agentNameBuffer.length);
    const dailyLimitBuffer = new BN(params.dailyLimitSol * LAMPORTS_PER_SOL).toArrayLike(Buffer, "le", 8);
    const perTxLimitBuffer = new BN(params.perTxLimitSol * LAMPORTS_PER_SOL).toArrayLike(Buffer, "le", 8);

    const data = Buffer.concat([
      getDiscriminator("create_agent_wallet"),
      nameLenBuffer,
      agentNameBuffer,
      dailyLimitBuffer,
      perTxLimitBuffer,
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: agentWallet, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: AGENTPAY_PROGRAM_ID,
      data,
    });
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

    const amountBuffer = new BN(params.amountSol * LAMPORTS_PER_SOL).toArrayLike(Buffer, "le", 8);
    const recipientBuffer = params.recipient.toBuffer();
    const reasonBuffer = Buffer.from(params.reason);
    const reasonLenBuffer = Buffer.alloc(4);
    reasonLenBuffer.writeUInt32LE(reasonBuffer.length);

    const data = Buffer.concat([
      getDiscriminator("request_payment"),
      amountBuffer,
      recipientBuffer,
      reasonLenBuffer,
      reasonBuffer,
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: agent, isSigner: true, isWritable: true },
        { pubkey: params.agentWallet, isSigner: false, isWritable: true },
        { pubkey: paymentRequest, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: AGENTPAY_PROGRAM_ID,
      data,
    });
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
    const data = getDiscriminator("approve_payment");

    return new TransactionInstruction({
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: agentWallet, isSigner: false, isWritable: true },
        { pubkey: paymentRequest, isSigner: false, isWritable: true },
        { pubkey: recipient, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: AGENTPAY_PROGRAM_ID,
      data,
    });
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
    const data = getDiscriminator("reject_payment");

    return new TransactionInstruction({
      keys: [
        { pubkey: owner, isSigner: true, isWritable: false },
        { pubkey: agentWallet, isSigner: false, isWritable: true },
        { pubkey: paymentRequest, isSigner: false, isWritable: true },
      ],
      programId: AGENTPAY_PROGRAM_ID,
      data,
    });
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

    const maxAmountBuffer = new BN(params.maxAmountSol * LAMPORTS_PER_SOL).toArrayLike(Buffer, "le", 8);
    const reasonBuffer = Buffer.from(params.reason);
    const reasonLenBuffer = Buffer.alloc(4);
    reasonLenBuffer.writeUInt32LE(reasonBuffer.length);

    const data = Buffer.concat([
      getDiscriminator("reserve_credit"),
      maxAmountBuffer,
      reasonLenBuffer,
      reasonBuffer,
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: agent, isSigner: true, isWritable: true },
        { pubkey: agentWallet, isSigner: false, isWritable: true },
        { pubkey: reservation, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: AGENTPAY_PROGRAM_ID,
      data,
    });
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
    const actualAmountBuffer = new BN(actualAmountSol * LAMPORTS_PER_SOL).toArrayLike(Buffer, "le", 8);
    const data = Buffer.concat([
      getDiscriminator("capture_payment"),
      actualAmountBuffer,
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: agentWallet, isSigner: false, isWritable: true },
        { pubkey: reservation, isSigner: false, isWritable: true },
        { pubkey: recipient, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: AGENTPAY_PROGRAM_ID,
      data,
    });
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
    const dailyLimitBuffer = new BN(dailyLimitSol * LAMPORTS_PER_SOL).toArrayLike(Buffer, "le", 8);
    const perTxLimitBuffer = new BN(perTxLimitSol * LAMPORTS_PER_SOL).toArrayLike(Buffer, "le", 8);

    const data = Buffer.concat([
      getDiscriminator("update_spending_limit"),
      dailyLimitBuffer,
      perTxLimitBuffer,
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: owner, isSigner: true, isWritable: false },
        { pubkey: agentWallet, isSigner: false, isWritable: true },
      ],
      programId: AGENTPAY_PROGRAM_ID,
      data,
    });
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
    const amountBuffer = new BN(amount).toArrayLike(Buffer, "le", 8);
    const data = Buffer.concat([
      getDiscriminator("stake_skr"),
      amountBuffer,
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: owner, isSigner: true, isWritable: false },
        { pubkey: agentWallet, isSigner: false, isWritable: true },
      ],
      programId: AGENTPAY_PROGRAM_ID,
      data,
    });
  }
}