import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCallback, useState, useEffect } from "react";
import {
  AgentPayClient,
  findAgentWalletPda,
  findPaymentRequestPda,
  findReservationPda,
  AGENTPAY_PROGRAM_ID,
} from "@/sdk";

export function useAgentPay() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [client, setClient] = useState<AgentPayClient | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize client
  useEffect(() => {
    if (connection) {
      setClient(new AgentPayClient(connection));
    }
  }, [connection]);

  // ─── Create Agent Wallet ─────────────────────────────────────────

  const createAgentWallet = useCallback(
    async (agentName: string, dailyLimitSol: number, perTxLimitSol: number) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");
      setLoading(true);
      setError(null);
      try {
        const ix = client.createAgentWalletIx(publicKey, {
          agentName,
          dailyLimitSol,
          perTxLimitSol,
        });

        const tx = new Transaction().add(ix);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

        const [agentWalletPda] = findAgentWalletPda(publicKey, agentName);
        return { signature, agentWalletPda };
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, sendTransaction, connection, client]
  );

  // ─── Approve Payment ─────────────────────────────────────────────

  const approvePayment = useCallback(
    async (agentWalletPda: PublicKey, paymentRequestPda: PublicKey, recipient: PublicKey) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");
      setLoading(true);
      setError(null);
      try {
        const ix = client.approvePaymentIx(publicKey, agentWalletPda, paymentRequestPda, recipient);

        const tx = new Transaction().add(ix);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
        return signature;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, sendTransaction, connection, client]
  );

  // ─── Reject Payment ──────────────────────────────────────────────

  const rejectPayment = useCallback(
    async (agentWalletPda: PublicKey, paymentRequestPda: PublicKey) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");
      setLoading(true);
      setError(null);
      try {
        const ix = client.rejectPaymentIx(publicKey, agentWalletPda, paymentRequestPda);

        const tx = new Transaction().add(ix);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
        return signature;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, sendTransaction, connection, client]
  );

  // ─── Update Spending Limit ────────────────────────────────────────

  const updateSpendingLimit = useCallback(
    async (agentWalletPda: PublicKey, dailyLimitSol: number, perTxLimitSol: number) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");
      setLoading(true);
      setError(null);
      try {
        const ix = client.updateSpendingLimitIx(publicKey, agentWalletPda, dailyLimitSol, perTxLimitSol);

        const tx = new Transaction().add(ix);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
        return signature;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, sendTransaction, connection, client]
  );

  // ─── Stake SKR ────────────────────────────────────────────────────

  const stakeSkr = useCallback(
    async (agentWalletPda: PublicKey, amount: number) => {
      if (!publicKey || !client) throw new Error("Wallet not connected");
      setLoading(true);
      setError(null);
      try {
        const ix = client.stakeSkrIx(publicKey, agentWalletPda, amount);

        const tx = new Transaction().add(ix);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
        return signature;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, sendTransaction, connection, client]
  );

  // ─── Check if PDA exists on-chain ────────────────────────────────

  const checkAccountExists = useCallback(
    async (address: PublicKey) => {
      if (!client) return false;
      try {
        return await client.accountExists(address);
      } catch {
        return false;
      }
    },
    [client]
  );

  return {
    publicKey,
    client,
    loading,
    error,
    createAgentWallet,
    approvePayment,
    rejectPayment,
    updateSpendingLimit,
    stakeSkr,
    checkAccountExists,
    findAgentWalletPda,
    findPaymentRequestPda,
    findReservationPda,
  };
}