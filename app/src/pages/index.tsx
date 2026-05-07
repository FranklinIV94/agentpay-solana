import { useState, useEffect, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { useAgentPay } from "../hooks/useAgentPay";
import { findAgentWalletPda, findPaymentRequestPda, AGENTPAY_PROGRAM_ID } from "@/sdk";
import { Shield, Zap, ChevronRight, ArrowUpRight, Bot, TrendingUp, ShieldCheck, ShieldAlert, Send, Activity, Coins, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Plus, Trophy, Link2, BarChart3, CreditCard, Globe, Search } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

interface AgentWallet {
  name: string;
  pda: string;
  dailyLimit: number;
  dailySpent: number;
  perTxLimit: number;
  isActive: boolean;
  skrStaked: number;
  totalApproved: number;
  totalRejected: number;
}

interface PendingPayment {
  id: string;
  agentName: string;
  agentPda: string;
  amount: number;
  recipient: string;
  reason: string;
  timestamp: number;
}

// ─── Direct Keypair Wallet (no adapter needed) ──────────────────────

function getStoredKeypair(): Keypair | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("agentpay_keypair");
    if (!stored) return null;
    const secret = Uint8Array.from(JSON.parse(stored));
    return Keypair.fromSecretKey(secret);
  } catch { return null; }
}

function storeKeypair(kp: Keypair) {
  localStorage.setItem("agentpay_keypair", JSON.stringify(Array.from(kp.secretKey)));
}

// ─── Component ──────────────────────────────────────────────────────

export default function Dashboard() {
  const { connection } = useConnection();
  const agentPay = useAgentPay();

  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [agents, setAgents] = useState<AgentWallet[]>([]);
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newDailyLimit, setNewDailyLimit] = useState("1");
  const [activeTab, setActiveTab] = useState<"payments" | "agents" | "leaderboard">("payments");
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const DEMO_MODE = true; // Set to false when devnet is accessible

  // Load or create keypair on mount
  useEffect(() => {
    let kp = getStoredKeypair();
    if (!kp) {
      kp = Keypair.generate();
      storeKeypair(kp);
    }
    setKeypair(kp);
  }, []);

  const publicKey = keypair?.publicKey ?? null;

  // In demo mode, set a simulated balance immediately
  useEffect(() => {
    if (DEMO_MODE && publicKey) {
      setBalance(2.5); // Simulated starting balance
      setDemoAgents();
    }
  }, [publicKey, DEMO_MODE]);

  // Set demo agents and pending payments
  const setDemoAgents = useCallback(() => {
    setAgents([
      { name: "GPT-4 Orchestrator", pda: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsj", dailyLimit: 2.0, dailySpent: 0.45, perTxLimit: 0.1, isActive: true, skrStaked: 5000, totalApproved: 47, totalRejected: 3 },
      { name: "Data Pipeline Agent", pda: "4vGrf6g5wGKDF3B9Xz3f7Y7nM7Q3F3eKJcW4BzH4W5Bh", dailyLimit: 0.5, dailySpent: 0.12, perTxLimit: 0.05, isActive: true, skrStaked: 0, totalApproved: 18, totalRejected: 1 },
    ]);
    setPending([
      { id: "p1", agentName: "GPT-4 Orchestrator", agentPda: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsj", amount: 0.0085, recipient: "9xKX...4Bh", reason: "LLM inference — GPT-4o-mini API call for market analysis", timestamp: Date.now() - 12000 },
      { id: "p2", agentName: "GPT-4 Orchestrator", agentPda: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsj", amount: 0.0002, recipient: "2vGr...8Kj", reason: "Helius RPC — transaction history query", timestamp: Date.now() - 45000 },
      { id: "p3", agentName: "Data Pipeline Agent", agentPda: "4vGrf6g5wGKDF3B9Xz3f7Y7nM7Q3F3eKJcW4BzH4W5Bh", amount: 0.05, recipient: "5zRe...2Lp", reason: "Reserve credit — variable-cost data extraction (max 0.05 SOL)", timestamp: Date.now() - 90000 },
    ]);
  }, []);

  // Auto-detect when balance becomes > 0 (after faucet use)
  useEffect(() => {
    if (DEMO_MODE || !publicKey || balance > 0) return;
    const interval = setInterval(async () => {
      try {
        const bal = await connection.getBalance(publicKey);
        const sol = bal / LAMPORTS_PER_SOL;
        if (sol > 0) setBalance(sol);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [publicKey, balance, connection, DEMO_MODE]);

  // Fetch balance
  useEffect(() => {
    if (!publicKey || DEMO_MODE) return;
    const interval = setInterval(() => {
      connection.getBalance(publicKey).then((b) => setBalance(b / LAMPORTS_PER_SOL)).catch(() => {});
    }, 10000);
    connection.getBalance(publicKey).then((b) => setBalance(b / LAMPORTS_PER_SOL)).catch(() => {});
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  // Check on-chain data
  useEffect(() => {
    if (!publicKey || DEMO_MODE) return;
    const check = async () => {
      try {
        const testNames = ["GPT-4 Orchestrator", "Data Pipeline Agent"];
        for (const name of testNames) {
          const [pda] = findAgentWalletPda(publicKey, name);
          const info = await connection.getAccountInfo(pda);
          if (info) { setIsLive(true); return; }
        }
      } catch { /* use demo mode */ }
    };
    check();
  }, [publicKey, connection]);

  // Demo data
  useEffect(() => {
    if (!publicKey) return;
    if (!isLive) {
      setAgents([
        { name: "GPT-4 Orchestrator", pda: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsj", dailyLimit: 2.0, dailySpent: 0.45, perTxLimit: 0.1, isActive: true, skrStaked: 5000, totalApproved: 47, totalRejected: 3 },
        { name: "Data Pipeline Agent", pda: "4vGrf6g5wGKDF3B9Xz3f7Y7nM7Q3F3eKJcW4BzH4W5Bh", dailyLimit: 0.5, dailySpent: 0.12, perTxLimit: 0.05, isActive: true, skrStaked: 0, totalApproved: 18, totalRejected: 1 },
      ]);
      setPending([
        { id: "p1", agentName: "GPT-4 Orchestrator", agentPda: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsj", amount: 0.0085, recipient: "9xKX...4Bh", reason: "LLM inference — GPT-4o-mini API call for market analysis", timestamp: Date.now() - 12000 },
        { id: "p2", agentName: "GPT-4 Orchestrator", agentPda: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsj", amount: 0.0002, recipient: "2vGr...8Kj", reason: "Helius RPC — transaction history query", timestamp: Date.now() - 45000 },
        { id: "p3", agentName: "Data Pipeline Agent", agentPda: "4vGrf6g5wGKDF3B9Xz3f7Y7nM7Q3F3eKJcW4BzH4W5Bh", amount: 0.05, recipient: "5zRe...2Lp", reason: "Reserve credit — variable-cost data extraction (max 0.05 SOL)", timestamp: Date.now() - 90000 },
      ]);
    }
  }, [publicKey, isLive]);

  // Simulated AI agent payment requests (demo mode)
  // Calls /api/agent-request which uses DeepSeek for AI-generated requests
  // Falls back to local simulation if API unavailable
  const LLM_PAYMENT_REASONS = [
    { agent: "GPT-4 Orchestrator", reasons: [
      "LLM inference — GPT-4o-mini API call for market analysis",
      "LLM inference — Code generation task (GPT-4o)",
      "Web search — Perplexity API for real-time data",
      "Embedding generation — text-embedding-3-small",
      "Function calling — tool use orchestration",
      "Image analysis — GPT-4 Vision API call",
    ], amounts: [0.005, 0.008, 0.012, 0.02, 0.035, 0.0015, 0.0005, 0.003] },
    { agent: "Data Pipeline Agent", reasons: [
      "Helius RPC — transaction history query",
      "Reserve credit — variable-cost data extraction",
      "Database write — Supabase insert operation",
      "IPFS pin — Pinata storage for dataset",
      "WebSocket subscription — real-time feed",
    ], amounts: [0.0002, 0.0005, 0.002, 0.01, 0.05, 0.001] },
  ];

  useEffect(() => {
    if (!publicKey || isLive || balance === 0) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/agent-request");
        const payment = await res.json();
        const agent = agents.find((a) => a.name === payment.agentName);
        setPending((prev) => {
          if (prev.length >= 6) return prev;
          return [...prev, {
            id: payment.id,
            agentName: payment.agentName,
            agentPda: agent?.pda ?? "",
            amount: payment.amount,
            recipient: payment.recipient,
            reason: payment.reason,
            timestamp: Date.now(),
          }];
        });
      } catch (e) {
        // Fallback: generate locally
        setPending((prev) => {
          if (prev.length >= 6) return prev;
          const src = LLM_PAYMENT_REASONS[Math.floor(Math.random() * LLM_PAYMENT_REASONS.length)];
          const reason = src.reasons[Math.floor(Math.random() * src.reasons.length)];
          const amount = src.amounts[Math.floor(Math.random() * src.amounts.length)];
          const id = `p_${Date.now()}`;
          const agent = agents.find((a) => a.name === src.agent);
          return [...prev, { id, agentName: src.agent, agentPda: agent?.pda ?? "", amount, recipient: `${Math.random().toString(36).slice(2, 6)}...${Math.random().toString(36).slice(2, 6)}`, reason, timestamp: Date.now() }];
        });
      }
    }, 10000 + Math.random() * 5000);
    return () => clearInterval(interval);
  }, [publicKey, isLive, balance, agents]);

  // ─── Direct sendTransaction (no wallet adapter) ──────────────────

  const sendDirect = useCallback(async (tx: Transaction) => {
    if (!keypair) throw new Error("No keypair");
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    tx.sign(keypair);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  }, [keypair, connection]);

  // ─── Transaction Handlers ──────────────────────────────────────────

  const handleApprove = useCallback(async (payment: PendingPayment) => {
    if (!publicKey || !keypair) return;
    setTxStatus("Approving payment...");
    try {
      if (isLive) {
        const [agentPda] = findAgentWalletPda(publicKey, payment.agentName);
        const [paymentPda] = findPaymentRequestPda(agentPda);
        const ix = new TransactionInstruction({
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: agentPda, isSigner: false, isWritable: true },
            { pubkey: paymentPda, isSigner: false, isWritable: true },
          ],
          programId: AGENTPAY_PROGRAM_ID,
          data: Buffer.from([21, 123, 195, 139, 107, 141, 34, 187]), // approve_payment discriminator
        });
        const sig = await sendDirect(new Transaction().add(ix));
        setTxStatus(`✅ Approved! TX: ${sig.slice(0, 8)}...`);
      } else {
        await new Promise((r) => setTimeout(r, 800));
        setTxStatus("✅ Approved (demo)");
      }
      // Update agent spending
      setAgents((prev) => prev.map((a) =>
        a.name === payment.agentName
          ? { ...a, dailySpent: a.dailySpent + payment.amount, totalApproved: a.totalApproved + 1 }
          : a
      ));
      // Update balance
      setBalance((prev) => Math.max(0, prev - payment.amount));
      setPending((prev) => prev.filter((p) => p.id !== payment.id));
    } catch (err: any) {
      setTxStatus(`❌ ${err.message}`);
    }
    setTimeout(() => setTxStatus(null), 5000);
  }, [publicKey, keypair, isLive, sendDirect]);

  const handleReject = useCallback(async (payment: PendingPayment) => {
    if (!publicKey || !keypair) return;
    setTxStatus("Rejecting payment...");
    try {
      if (isLive) {
        const [agentPda] = findAgentWalletPda(publicKey, payment.agentName);
        const [paymentPda] = findPaymentRequestPda(agentPda);
        const ix = new TransactionInstruction({
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: agentPda, isSigner: false, isWritable: true },
            { pubkey: paymentPda, isSigner: false, isWritable: true },
          ],
          programId: AGENTPAY_PROGRAM_ID,
          data: Buffer.from([199, 215, 82, 136, 197, 236, 68, 26]), // reject_payment discriminator
        });
        const sig = await sendDirect(new Transaction().add(ix));
        setTxStatus(`🚫 Rejected! TX: ${sig.slice(0, 8)}...`);
      } else {
        await new Promise((r) => setTimeout(r, 400));
        setTxStatus("🚫 Rejected (demo)");
      }
      // Update rejection count
      setAgents((prev) => prev.map((a) =>
        a.name === payment.agentName
          ? { ...a, totalRejected: a.totalRejected + 1 }
          : a
      ));
      setPending((prev) => prev.filter((p) => p.id !== payment.id));
    } catch (err: any) {
      setTxStatus(`❌ ${err.message}`);
    }
    setTimeout(() => setTxStatus(null), 5000);
  }, [publicKey, keypair, isLive, sendDirect]);

  const handleApproveAll = useCallback(async () => {
    for (const payment of pending) await handleApprove(payment);
  }, [pending, handleApprove]);

  const handleCreateAgent = useCallback(async () => {
    if (!newAgentName.trim() || !publicKey || !keypair) return;
    setTxStatus("Creating agent wallet...");
    try {
      const daily = parseFloat(newDailyLimit) || 1;
      if (isLive) {
        const [agentPda] = findAgentWalletPda(publicKey, newAgentName);
        const ix = new TransactionInstruction({
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: agentPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: AGENTPAY_PROGRAM_ID,
          data: Buffer.from([
            ...[243, 173, 1, 184, 209, 14, 51, 108], // create_agent_wallet discriminator
            ...new TextEncoder().encode(newAgentName),
            ...new Uint8Array(new Float64Array([daily]).buffer),
            ...new Uint8Array(new Float64Array([daily * 0.1]).buffer),
          ]),
        });
        const sig = await sendDirect(new Transaction().add(ix));
        setTxStatus(`✅ Agent created! TX: ${sig.slice(0, 8)}...`);
      } else {
        await new Promise((r) => setTimeout(r, 800));
        setTxStatus("✅ Agent created (demo)");
      }
      setAgents((prev) => [...prev, { name: newAgentName, pda: "new_" + Date.now(), dailyLimit: daily, dailySpent: 0, perTxLimit: daily * 0.1, isActive: true, skrStaked: 0, totalApproved: 0, totalRejected: 0 }]);
      setNewAgentName("");
      setNewDailyLimit("1");
      setShowCreate(false);
    } catch (err: any) {
      setTxStatus(`❌ ${err.message}`);
    }
    setTimeout(() => setTxStatus(null), 5000);
  }, [newAgentName, newDailyLimit, publicKey, keypair, isLive, sendDirect]);

  const handleAirdrop = useCallback(async () => {
    if (!publicKey) return;
    setTxStatus("Requesting airdrop...");
    try {
      // Try airdrop with retry
      let sig: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
          break;
        } catch (e: any) {
          if (attempt < 2) {
            setTxStatus(`Airdrop attempt ${attempt + 1} failed, retrying...`);
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          } else {
            throw e;
          }
        }
      }
      if (sig) {
        // Use blockhash-based confirmation
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        const bal = await connection.getBalance(publicKey);
        setBalance(bal / LAMPORTS_PER_SOL);
        setTxStatus("✅ 1 SOL airdropped!");
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("429") || msg.includes("rate") || msg.includes("Too many")) {
        setTxStatus("❌ Airdrop rate-limited. Wait 60s and try again.");
      } else if (msg.includes("0x1")) {
        setTxStatus("❌ Airdrop failed. Try again in 30s.");
      } else {
        setTxStatus(`❌ Airdrop failed: ${msg.slice(0, 60)}`);
      }
    }
    setTimeout(() => setTxStatus(null), 6000);
  }, [publicKey, connection]);

  // ─── Not Connected ──────────────────────────────────────────────────

  if (!keypair) {
    return <div className="min-h-screen flex items-center justify-center text-indigo-400">Loading...</div>;
  }

  if (!publicKey) return null;

  // ─── Landing / Connect ──────────────────────────────────────────────

  if (balance === 0 && agents.length === 0 && !isLive && !DEMO_MODE) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">⚡</div>
          <h1 className="text-3xl font-bold mb-1">AgentPay</h1>
          <p className="text-indigo-300 mb-1 text-sm">The Payment Layer for AI Agents on Solana</p>
          <p className="text-indigo-400/60 mb-2 text-xs">Built for Seeker · Consensus Miami 2026</p>
          <p className="text-indigo-400/40 mb-6 text-xs font-mono break-all px-4">{publicKey.toString()}</p>
          <button onClick={handleAirdrop} className="glow-button px-8 py-4 rounded-2xl text-white font-semibold text-lg" disabled={!!txStatus}>
            🪂 Get Devnet SOL & Enter
          </button>
          <div className="mt-4 space-y-2">
            <a
              href={`https://faucet.solana.com/?address=${publicKey.toString()}&cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-indigo-400 underline hover:text-indigo-300"
            >
              💧 Or fund via Solana Faucet (opens in browser)
            </a>
            <p className="text-indigo-500/40 text-xs">Airdrop may take 30-60s. Faucet is faster.</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Dashboard ───────────────────────────────────────────────────────

  const totalDailyLimit = agents.reduce((s, a) => s + a.dailyLimit, 0);
  const totalDailySpent = agents.reduce((s, a) => s + a.dailySpent, 0);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-indigo-800/30 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold">AgentPay</h1>
          {pending.length > 0 && <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full pulse">{pending.length}</span>}
          {isLive && <span className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">LIVE</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-indigo-300 font-mono">{publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}</span>
          <span className="text-xs text-indigo-400">{balance.toFixed(3)} SOL</span>
          <button onClick={handleAirdrop} className="text-xs text-indigo-500 hover:text-indigo-300 ml-1" title="Airdrop SOL">🪂</button>
          <button onClick={() => { localStorage.removeItem("agentpay_keypair"); setKeypair(Keypair.generate()); storeKeypair(Keypair.generate()); setBalance(0); setIsLive(false); }} className="text-xs text-indigo-500 hover:text-indigo-300 ml-1" title="New wallet">🔄</button>
        </div>
      </header>

      {/* Transaction Status Toast */}
      {txStatus && (
        <div className="fixed top-14 left-0 right-0 z-50 flex justify-center">
          <div className="bg-indigo-900/90 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-b-xl border border-indigo-600/30">{txStatus}</div>
        </div>
      )}

      {/* Daily Overview */}
      <div className="px-4 pt-4">
        <div className="card p-4">
          <div className="flex justify-between text-sm text-indigo-300 mb-2">
            <span>Daily Spending</span>
            <span className="font-mono">{totalDailySpent.toFixed(4)} / {totalDailyLimit.toFixed(1)} SOL</span>
          </div>
          <div className="w-full bg-indigo-900 rounded-full h-2.5 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-400 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min((totalDailySpent / totalDailyLimit) * 100, 100)}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-indigo-400/60">
            <span>{agents.length} agent{agents.length !== 1 && "s"} active</span>
            <span>{((totalDailySpent / totalDailyLimit) * 100).toFixed(1)}% used</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 pt-4 flex gap-1 bg-black/20 rounded-xl mx-4 p-1">
        {(["payments", "agents", "leaderboard"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === tab ? "bg-indigo-600 text-white" : "text-indigo-400 hover:text-indigo-200"}`}>
            {tab === "payments" && `Approvals${pending.length > 0 ? ` (${pending.length})` : ""}`}
            {tab === "agents" && "Agents"}
            {tab === "leaderboard" && "🏆"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 pt-4 space-y-3">
        {activeTab === "payments" && (
          <>
            {pending.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-indigo-300">All caught up</p>
                <p className="text-indigo-400/50 text-xs mt-1">No pending agent payments</p>
              </div>
            ) : (
              <>
                {pending.length > 1 && <button onClick={handleApproveAll} className="w-full approve-button text-white py-2.5 rounded-xl font-semibold text-sm">Approve All ({pending.length})</button>}
                {pending.map((payment) => (
                  <div key={payment.id} className="card p-4 slide-up">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">{payment.agentName}</p>
                        <p className="text-indigo-400 text-xs mt-0.5">{Math.round((Date.now() - payment.timestamp) / 1000)}s ago · → {payment.recipient}</p>
                      </div>
                      <span className="text-purple-400 font-bold text-lg font-mono">{payment.amount.toFixed(4)}<span className="text-xs text-indigo-400 ml-1">SOL</span></span>
                    </div>
                    <p className="text-indigo-300 text-xs mb-3 bg-indigo-950/50 rounded-lg px-3 py-2">{payment.reason}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(payment)} className="flex-1 approve-button text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Approve</button>
                      <button onClick={() => handleReject(payment)} className="flex-1 reject-button text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5"><XCircle className="w-4 h-4" /> Reject</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {activeTab === "agents" && (
          <>
            <button onClick={() => setShowCreate(!showCreate)} className="w-full glow-button text-white py-2.5 rounded-xl font-semibold text-sm">+ Create Agent Wallet</button>
            {showCreate && (
              <div className="card p-4 slide-up">
                <input type="text" placeholder="Agent name" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} className="w-full bg-indigo-950/50 border border-indigo-700/50 rounded-xl px-3 py-2.5 text-white placeholder-indigo-500 text-sm mb-2" />
                <input type="number" step="0.1" placeholder="Daily limit (SOL)" value={newDailyLimit} onChange={(e) => setNewDailyLimit(e.target.value)} className="w-full bg-indigo-950/50 border border-indigo-700/50 rounded-xl px-3 py-2.5 text-white placeholder-indigo-500 text-sm mb-3" />
                <button onClick={handleCreateAgent} className="w-full approve-button text-white py-2.5 rounded-xl font-semibold text-sm">Create Agent</button>
              </div>
            )}
            {agents.map((agent) => (
              <div key={agent.pda} className="card p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{agent.isActive ? "🟢" : "🔴"}</span>
                    <span className="font-medium">{agent.name}</span>
                  </div>
                  {agent.skrStaked > 0 && <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded-full">🪙 SKR ×2</span>}
                </div>
                <div className="w-full bg-indigo-900 rounded-full h-1.5 mb-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-400 h-1.5 rounded-full" style={{ width: `${Math.min((agent.dailySpent / agent.dailyLimit) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-indigo-400">
                  <span>{agent.dailySpent.toFixed(3)} / {agent.dailyLimit} SOL daily</span>
                  <span>{agent.totalApproved}✅ {agent.totalRejected}❌</span>
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === "leaderboard" && (
          <div className="card p-4 text-center">
            <div className="text-4xl mb-3">🏆</div>
            <p className="text-indigo-300 font-medium">Agent Operator Leaderboard</p>
            <p className="text-indigo-400/50 text-xs mt-1">Ranks by approved transaction volume</p>
            <div className="mt-4 space-y-2">
              {[
                { rank: 1, name: "You", vol: "12.45 SOL", badge: "🥇" },
                { rank: 2, name: "s0lseeker.eth", vol: "8.21 SOL", badge: "🥈" },
                { rank: 3, name: "agentlord.sol", vol: "6.03 SOL", badge: "🥉" },
              ].map((entry) => (
                <div key={entry.rank} className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm ${entry.name === "You" ? "bg-indigo-900/50 border border-indigo-600/30" : "bg-indigo-950/30"}`}>
                  <span>{entry.badge} {entry.name}</span>
                  <span className="font-mono text-indigo-300">{entry.vol}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SKR Staking Banner */}
      <div className="px-4 pt-4">
        <div className="card p-4 border-amber-900/30">
          <div className="flex items-center gap-2 mb-1"><Coins className="w-4 h-4 text-amber-400" /><span className="font-medium text-sm">SKR Staking</span></div>
          <p className="text-indigo-300/70 text-xs mb-3">Stake SKR for 2x spending limits and premium Seeker-only analytics</p>
          <button onClick={async () => { setTxStatus("Staking SKR..."); await new Promise(r => setTimeout(r, 800)); setTxStatus("✅ Staked 5000 SKR (demo)"); setTimeout(() => setTxStatus(null), 5000); }} className="skr-button text-white py-2.5 rounded-xl font-semibold text-sm w-full">Stake SKR Tokens</button>
        </div>
      </div>

      {/* Cross-chain Bridge Banner */}
      <div className="px-4 pt-4">
        <div className="card p-4 border-cyan-900/30">
          <div className="flex items-center gap-2 mb-1"><Link2 className="w-4 h-4 text-cyan-400" /><span className="font-medium text-sm">Cross-Chain x402 Bridge</span><span className="text-[10px] bg-cyan-900/50 text-cyan-400 px-1.5 py-0.5 rounded-full ml-1">Base ↔ Solana</span></div>
          <p className="text-indigo-300/70 text-xs mb-3">AI agents on Base pay via x402 → human approves on Solana Seeker</p>
          <div className="space-y-2">
            {[
              { id: "market-feed", name: "Market Data", price: "$0.01", icon: BarChart3 },
              { id: "risk-signal", name: "Fraud Risk", price: "$0.02", icon: ShieldAlert },
              { id: "sanctions-screen", name: "Sanctions", price: "$0.05", icon: Search },
              { id: "credit-bureau", name: "Credit", price: "$0.10", icon: CreditCard },
              { id: "fx-rates", name: "FX Rates", price: "$0.01", icon: Globe },
            ].map((svc) => (
              <div key={svc.id} className="flex justify-between items-center bg-cyan-950/30 rounded-lg px-3 py-2 text-sm">
                <span className="text-indigo-300 flex items-center gap-1.5"><svc.icon className="w-3.5 h-3.5" /> {svc.name}</span>
                <span className="text-cyan-400 font-mono text-xs">x402 {svc.price}</span>
              </div>
            ))}
          </div>
          <a href="https://agent-studio-fawn.vercel.app/api/x402/data" target="_blank" rel="noopener" className="block text-center w-full x402-button text-white py-2.5 rounded-xl font-semibold text-sm mt-3">
            <span className="flex items-center justify-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> View x402 API</span>
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pt-6 text-center">
        <p className="text-indigo-500/30 text-xs">AgentPay · Solana Seeker Track · Consensus Miami 2026</p>
        <p className="text-indigo-500/20 text-xs mt-1">Franklin Bryant IV · Prospyr Inc</p>
      </div>
    </div>
  );
}