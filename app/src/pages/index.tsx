import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { useAgentPay } from "../hooks/useAgentPay";
import { findAgentWalletPda, findPaymentRequestPda, AGENTPAY_PROGRAM_ID } from "@/sdk";
import { Shield, Zap, ChevronRight, ArrowUpRight, Bot, TrendingUp, ShieldCheck, ShieldAlert, Send, Activity, Coins, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Plus, Trophy, Link2, BarChart3, CreditCard, Globe, Search, Play, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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

// ─── Animation Config ─────────────────────────────────────────────────

const smooth = { type: "spring" as const, stiffness: 300, damping: 25 };
const snappy = { type: "spring" as const, stiffness: 500, damping: 30 };

const HERO_VIDEO = "https://cdn.muapi.ai/outputs/0bf67131c36b44838bb09aac61def522.mp4";

const PIPELINE_STEPS = [
  { icon: Bot, label: "Agent Requests", desc: "AI agent submits tx on-chain", color: "from-purple-500 to-pink-500", bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400" },
  { icon: Zap, label: "Seeker Alert", desc: "Real-time push notification", color: "from-amber-500 to-yellow-400", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
  { icon: ShieldCheck, label: "Human Approves", desc: "One tap — instant settlement", color: "from-emerald-500 to-green-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
  { icon: Send, label: "On-Chain Settled", desc: "Solana finality in <400ms", color: "from-cyan-500 to-blue-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400" },
];

const STATS = [
  { value: "8", label: "On-chain instructions" },
  { value: "<400ms", label: "Settlement speed" },
  { value: "1 tap", label: "Approve or reject" },
];

const FEATURES = [
  { icon: Shield, title: "Spending Limits", desc: "On-chain limits agents cannot exceed. Daily and per-transaction caps enforced by the Solana program." },
  { icon: Zap, title: "Real-time Alerts", desc: "Push notifications on the Seeker phone the instant an agent requests payment. No blind spots." },
  { icon: Coins, title: "SKR Staking", desc: "Stake SKR tokens for 2× spending limits and premium analytics. Incentivized security." },
  { icon: Activity, title: "Live Dashboard", desc: "Track daily spend, agent activity, and approval rates — all in real-time." },
];

// ─── Scroll Reveal Hook ──────────────────────────────────────────────

function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function SectionReveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Video Player ─────────────────────────────────────────────────────

function VideoPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="relative rounded-xl overflow-hidden bg-black border border-white/10">
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video object-cover"
        controls={playing}
        playsInline
        preload="metadata"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      {!playing && (
        <button
          onClick={() => videoRef.current?.play()}
          className="absolute inset-0 flex items-center justify-center group"
          aria-label="Play demo"
        >
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
          <div className="relative w-16 h-16 rounded-full bg-white/15 backdrop-blur-xl border border-white/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/25 transition-all shadow-2xl">
            <svg width="18" height="20" viewBox="0 0 18 20" fill="none" className="ml-0.5">
              <path d="M1 2L17 10L1 18V2Z" fill="white" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}

// ─── Pipeline Step ────────────────────────────────────────────────────

function PipelineStep({ step, index }: { step: typeof PIPELINE_STEPS[0]; index: number }) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...smooth, delay: index * 0.15 + 0.3 }}
      className={`relative rounded-2xl border p-4 transition-colors ${step.bg} ${step.border}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${step.color} shadow-lg shrink-0`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white text-sm">{step.label}</h4>
          <p className="text-[11px] text-white/50 mt-0.5">{step.desc}</p>
        </div>
      </div>
      {index < PIPELINE_STEPS.length - 1 && (
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ ...smooth, delay: index * 0.15 + 0.45 }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-px h-3 bg-gradient-to-b from-white/20 to-transparent origin-top"
        />
      )}
    </motion.div>
  );
}

// ─── Direct Keypair Wallet ────────────────────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────────

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
  const [showDashboard, setShowDashboard] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const DEMO_MODE = true;

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
      setBalance(2.5);
      setDemoAgents();
    }
  }, [publicKey, DEMO_MODE]);

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

  // Simulated AI agent payment requests
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
          return [...prev, { id: payment.id, agentName: payment.agentName, agentPda: agent?.pda ?? "", amount: payment.amount, recipient: payment.recipient, reason: payment.reason, timestamp: Date.now() }];
        });
      } catch {
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

  const handleApprove = useCallback(async (payment: PendingPayment) => {
    if (!publicKey || !keypair) return;
    setTxStatus("Approving payment...");
    try {
      if (isLive) {
        const [agentPda] = findAgentWalletPda(publicKey, payment.agentName);
        const [paymentPda] = findPaymentRequestPda(agentPda);
        const ix = new TransactionInstruction({ keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }, { pubkey: agentPda, isSigner: false, isWritable: true }, { pubkey: paymentPda, isSigner: false, isWritable: true }], programId: AGENTPAY_PROGRAM_ID, data: Buffer.from([21, 123, 195, 139, 107, 141, 34, 187]) });
        const sig = await sendDirect(new Transaction().add(ix));
        setTxStatus(`✅ Approved! TX: ${sig.slice(0, 8)}...`);
      } else {
        await new Promise((r) => setTimeout(r, 800));
        setTxStatus("✅ Approved (demo)");
      }
      setAgents((prev) => prev.map((a) => a.name === payment.agentName ? { ...a, dailySpent: a.dailySpent + payment.amount, totalApproved: a.totalApproved + 1 } : a));
      setBalance((prev) => Math.max(0, prev - payment.amount));
      setPending((prev) => prev.filter((p) => p.id !== payment.id));
    } catch (err: any) { setTxStatus(`❌ ${err.message}`); }
    setTimeout(() => setTxStatus(null), 5000);
  }, [publicKey, keypair, isLive, sendDirect]);

  const handleReject = useCallback(async (payment: PendingPayment) => {
    if (!publicKey || !keypair) return;
    setTxStatus("Rejecting payment...");
    try {
      if (isLive) {
        const [agentPda] = findAgentWalletPda(publicKey, payment.agentName);
        const [paymentPda] = findPaymentRequestPda(agentPda);
        const ix = new TransactionInstruction({ keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }, { pubkey: agentPda, isSigner: false, isWritable: true }, { pubkey: paymentPda, isSigner: false, isWritable: true }], programId: AGENTPAY_PROGRAM_ID, data: Buffer.from([199, 215, 82, 136, 197, 236, 68, 26]) });
        const sig = await sendDirect(new Transaction().add(ix));
        setTxStatus(`🚫 Rejected! TX: ${sig.slice(0, 8)}...`);
      } else {
        await new Promise((r) => setTimeout(r, 400));
        setTxStatus("🚫 Rejected (demo)");
      }
      setAgents((prev) => prev.map((a) => a.name === payment.agentName ? { ...a, totalRejected: a.totalRejected + 1 } : a));
      setPending((prev) => prev.filter((p) => p.id !== payment.id));
    } catch (err: any) { setTxStatus(`❌ ${err.message}`); }
    setTimeout(() => setTxStatus(null), 5000);
  }, [publicKey, keypair, isLive, sendDirect]);

  const handleApproveAll = useCallback(async () => { for (const payment of pending) await handleApprove(payment); }, [pending, handleApprove]);

  const handleCreateAgent = useCallback(async () => {
    if (!newAgentName.trim() || !publicKey || !keypair) return;
    setTxStatus("Creating agent wallet...");
    try {
      const daily = parseFloat(newDailyLimit) || 1;
      if (isLive) {
        const [agentPda] = findAgentWalletPda(publicKey, newAgentName);
        const ix = new TransactionInstruction({ keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }, { pubkey: agentPda, isSigner: false, isWritable: true }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }], programId: AGENTPAY_PROGRAM_ID, data: Buffer.from([...[243, 173, 1, 184, 209, 14, 51, 108], ...new TextEncoder().encode(newAgentName), ...new Uint8Array(new Float64Array([daily]).buffer), ...new Uint8Array(new Float64Array([daily * 0.1]).buffer)]) });
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
    } catch (err: any) { setTxStatus(`❌ ${err.message}`); }
    setTimeout(() => setTxStatus(null), 5000);
  }, [newAgentName, newDailyLimit, publicKey, keypair, isLive, sendDirect]);

  const handleAirdrop = useCallback(async () => {
    if (!publicKey) return;
    setTxStatus("Requesting airdrop...");
    try {
      let sig: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL); break; } catch (e: any) {
          if (attempt < 2) { setTxStatus(`Airdrop attempt ${attempt + 1} failed, retrying...`); await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); } else { throw e; }
        }
      }
      if (sig) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        const bal = await connection.getBalance(publicKey);
        setBalance(bal / LAMPORTS_PER_SOL);
        setTxStatus("✅ 1 SOL airdropped!");
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("429") || msg.includes("rate") || msg.includes("Too many")) { setTxStatus("❌ Airdrop rate-limited. Wait 60s and try again."); }
      else if (msg.includes("0x1")) { setTxStatus("❌ Airdrop failed. Try again in 30s."); }
      else { setTxStatus(`❌ Airdrop failed: ${msg.slice(0, 60)}`); }
    }
    setTimeout(() => setTxStatus(null), 6000);
  }, [publicKey, connection]);

  // ─── Not Connected ──────────────────────────────────────────────────

  if (!keypair) {
    return <div className="min-h-screen flex items-center justify-center text-indigo-400">Loading...</div>;
  }

  if (!publicKey) return null;

  // ─── Landing / Connect (non-demo, no balance) ─────────────────────

  if (balance === 0 && agents.length === 0 && !isLive && !DEMO_MODE) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">⚡</div>
          <h1 className="text-3xl font-bold mb-1">AgentPay</h1>
          <p className="text-indigo-300 mb-1 text-sm">The Payment Layer for AI Agents on Solana</p>
          <p className="text-indigo-400/60 mb-2 text-xs">Built for Seeker · Consensus Miami 2026</p>
          <p className="text-indigo-400/40 mb-6 text-xs font-mono break-all px-4">{publicKey.toString()}</p>
          <button onClick={handleAirdrop} className="glow-button px-8 py-4 rounded-2xl text-white font-semibold text-lg" disabled={!!txStatus}>🪂 Get Devnet SOL & Enter</button>
          <div className="mt-4 space-y-2">
            <a href={`https://faucet.solana.com/?address=${publicKey.toString()}&cluster=devnet`} target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-400 underline hover:text-indigo-300">💧 Or fund via Solana Faucet (opens in browser)</a>
            <p className="text-indigo-500/40 text-xs">Airdrop may take 30-60s. Faucet is faster.</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Animated Landing + Dashboard ──────────────────────────────────

  const totalDailyLimit = agents.reduce((s, a) => s + a.dailyLimit, 0);
  const totalDailySpent = agents.reduce((s, a) => s + a.dailySpent, 0);

  return (
    <div className="min-h-screen pb-24">
      {/* ═══════════════════════════════════════════════════════════════
          LANDING HERO — Same animation polish as Agent Studio
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {!showDashboard && (
          <motion.div
            key="landing"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen bg-gradient-to-b from-[#0A0520] via-[#0c1445] to-[#0A0520]"
          >
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-2xl border-b border-purple-500/10">
              <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white">AgentPay</span>
                    <span className="text-[10px] text-purple-400 ml-2 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">SOLANA</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <a href="https://agent-studio-fawn.vercel.app" target="_blank" rel="noopener" className="text-xs text-white/30 hover:text-white/70 transition">Agent Studio ↗</a>
                  <a href="https://github.com/FranklinIV94/agentpay-solana" target="_blank" rel="noopener" className="text-xs text-white/30 hover:text-white/70 transition">GitHub ↗</a>
                  <button onClick={() => setShowDashboard(true)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold hover:opacity-90 transition">
                    Launch Dashboard →
                  </button>
                </div>
              </div>
            </nav>

            {/* Hero Video + Title */}
            <section className="pt-28 pb-16 px-6">
              <div className="max-w-5xl mx-auto">
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...smooth, delay: 0.1 }} className="relative rounded-2xl overflow-hidden border border-purple-500/20 shadow-2xl shadow-purple-900/30 mb-12">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/45 z-20 pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-900/25 via-transparent to-pink-900/25 z-20 pointer-events-none" />
                  <video
                    src={HERO_VIDEO}
                    className="w-full block"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    style={{ maxHeight: "70vh", objectFit: "cover" }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 z-30 p-8 pb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-[10px] text-white/70 backdrop-blur-md font-medium">Solana Seeker · Consensus Miami 2026</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-white/40">Live</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black leading-[1.02] mb-3">
                      <span className="text-white">AI Agents That</span>
                      <br />
                      <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Pay Their Bills</span>
                    </h1>
                    <p className="text-sm text-white/40 max-w-lg">Mobile-first dashboard for humans to govern AI agent spending in real-time. Built for the Solana Seeker phone.</p>
                  </div>
                </motion.div>

                {/* Stats */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...smooth, delay: 0.3 }} className="grid grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden mb-16">
                  {STATS.map((stat, i) => (
                    <div key={i} className="bg-black/70 backdrop-blur-xl px-6 py-6 text-center border border-white/5">
                      <div className="stat-n mb-1">{stat.value}</div>
                      <div className="text-[10px] text-white/30 uppercase tracking-widest">{stat.label}</div>
                    </div>
                  ))}
                </motion.div>
              </div>
            </section>

            {/* How It Works — Animated Pipeline */}
            <section className="py-20 px-6 bg-white/[0.02]">
              <div className="max-w-5xl mx-auto">
                <SectionReveal>
                  <div className="flex items-center gap-4 mb-12">
                    <span className="h-px w-16 bg-white/10" />
                    <span className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">How It Works</span>
                  </div>
                </SectionReveal>

                <div className="grid md:grid-cols-2 gap-8">
                  {/* Pipeline Steps */}
                  <div className="space-y-3">
                    <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...smooth, delay: 0.2 }} className="text-3xl font-bold text-white mb-6">
                      Agent requests.<br />
                      <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Human approves.</span>
                    </motion.h2>
                    <div className="space-y-4">
                      {PIPELINE_STEPS.map((step, i) => (
                        <PipelineStep key={i} step={step} index={i} />
                      ))}
                    </div>
                  </div>

                  {/* Video */}
                  <div className="space-y-6">
                    <SectionReveal delay={200}>
                      <div className="relative">
                        <VideoPlayer src={HERO_VIDEO} />
                        <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] text-white/60 font-medium">
                          Seeker Demo
                        </div>
                      </div>
                    </SectionReveal>
                    <SectionReveal delay={300}>
                      <div className="grid grid-cols-2 gap-3">
                        <a href="https://agentpay-solana.vercel.app" className="block p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-colors text-center">
                          <span className="text-sm font-semibold text-white">Open Live App →</span>
                          <p className="text-[10px] text-white/40 mt-1">Solana Seeker</p>
                        </a>
                        <a href="https://github.com/FranklinIV94/agentpay-solana" className="block p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-center">
                          <span className="text-sm font-semibold text-white/80">View Source</span>
                          <p className="text-[10px] text-white/40 mt-1">GitHub ↗</p>
                        </a>
                      </div>
                    </SectionReveal>
                  </div>
                </div>
              </div>
            </section>

            {/* Features */}
            <section className="py-20 px-6">
              <div className="max-w-5xl mx-auto">
                <SectionReveal>
                  <div className="flex items-center gap-4 mb-12">
                    <span className="h-px w-16 bg-white/10" />
                    <span className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">Features</span>
                  </div>
                </SectionReveal>

                <div className="grid md:grid-cols-2 gap-5">
                  {FEATURES.map((f, i) => {
                    const Icon = f.icon;
                    return (
                      <SectionReveal key={i} delay={i * 80}>
                        <div className="bg-black/40 rounded-2xl p-7 border border-white/5 flex gap-5 hover:bg-black/60 transition-colors hover:-translate-y-1 duration-300">
                          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-lg mb-2">{f.title}</h3>
                            <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
                          </div>
                        </div>
                      </SectionReveal>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* x402 Integration */}
            <section className="py-16 px-6 bg-white/[0.02]">
              <div className="max-w-5xl mx-auto">
                <SectionReveal>
                  <div className="flex items-center gap-4 mb-12">
                    <span className="h-px w-16 bg-white/10" />
                    <span className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">Cross-Chain Integration</span>
                  </div>
                </SectionReveal>

                <SectionReveal delay={100}>
                  <div className="bg-black/50 rounded-2xl p-8 border border-cyan-500/10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-4 h-4 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
                      <h3 className="text-xl font-bold text-white">Agent Studio → AgentPay</h3>
                      <span className="text-[10px] bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded-full">Base ↔ Solana</span>
                    </div>
                    <p className="text-white/40 text-sm leading-relaxed mb-6">
                      AI agents on Base pay via x402 micropayments. Human approves on Solana Seeker. Full-stack agentic commerce — two chains, one narrative.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {["Solana Anchor", "Next.js 14", "AWS Lambda", "DeepSeek AI", "x402 Protocol", "Coinbase Wallet"].map(tech => (
                        <span key={tech} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:border-white/20 hover:text-white/70 transition-colors cursor-default">{tech}</span>
                      ))}
                    </div>
                  </div>
                </SectionReveal>
              </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6">
              <div className="max-w-3xl mx-auto text-center">
                <SectionReveal>
                  <h2 className="text-3xl font-bold text-white mb-4">Try it on the Seeker</h2>
                  <p className="text-white/40 mb-8">Built for Consensus 2026 Miami. Open the dashboard to approve and reject agent payments in real-time.</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                      onClick={() => setShowDashboard(true)}
                      className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition text-sm shadow-lg shadow-purple-500/20"
                    >
                      Launch Dashboard →
                    </button>
                    <a
                      href="https://consensus-submission.vercel.app"
                      target="_blank"
                      rel="noopener"
                      className="px-8 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white/70 font-medium hover:bg-white/10 hover:text-white transition text-sm"
                    >
                      View Full Submission ↗
                    </a>
                  </div>
                </SectionReveal>
              </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-white/5">
              <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/30">
                <span>AgentPay · Solana Seeker Track · Consensus 2026</span>
                <span>Franklin Bryant IV · Prospyr Inc</span>
                <a href="https://github.com/FranklinIV94" target="_blank" rel="noopener" className="hover:text-white/60 transition">@FranklinIV94 ↗</a>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════
          DASHBOARD — Functional app (shown after "Launch Dashboard")
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDashboard && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
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
                <button onClick={() => setShowDashboard(false)} className="text-xs text-indigo-400 hover:text-indigo-200 transition">← Landing</button>
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
                        <motion.div key={payment.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={snappy} className="card p-4">
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
                        </motion.div>
                      ))}
                    </>
                  )}
                </>
              )}

              {activeTab === "agents" && (
                <>
                  <button onClick={() => setShowCreate(!showCreate)} className="w-full glow-button text-white py-2.5 rounded-xl font-semibold text-sm">+ Create Agent Wallet</button>
                  {showCreate && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={snappy} className="card p-4">
                      <input type="text" placeholder="Agent name" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} className="w-full bg-indigo-950/50 border border-indigo-700/50 rounded-xl px-3 py-2.5 text-white placeholder-indigo-500 text-sm mb-2" />
                      <input type="number" step="0.1" placeholder="Daily limit (SOL)" value={newDailyLimit} onChange={(e) => setNewDailyLimit(e.target.value)} className="w-full bg-indigo-950/50 border border-indigo-700/50 rounded-xl px-3 py-2.5 text-white placeholder-indigo-500 text-sm mb-3" />
                      <button onClick={handleCreateAgent} className="w-full approve-button text-white py-2.5 rounded-xl font-semibold text-sm">Create Agent</button>
                    </motion.div>
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

            {/* Dashboard Footer */}
            <div className="px-4 pt-6 text-center">
              <p className="text-indigo-500/30 text-xs">AgentPay · Solana Seeker Track · Consensus Miami 2026</p>
              <p className="text-indigo-500/20 text-xs mt-1">Franklin Bryant IV · Prospyr Inc</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}