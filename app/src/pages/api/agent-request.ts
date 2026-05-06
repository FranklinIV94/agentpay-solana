import type { NextApiRequest, NextApiResponse } from "next";

// AI Agent Payment Decision Engine
// Uses DeepSeek API to generate realistic AI agent payment requests
// Falls back to local simulation if API is unavailable

interface PaymentRequest {
  id: string;
  agentName: string;
  amount: number;
  recipient: string;
  reason: string;
  category: string;
  urgency: "low" | "medium" | "high";
}

const AGENTS = [
  {
    name: "GPT-4 Orchestrator",
    wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsj",
    dailyLimit: 2.0,
    categories: [
      "LLM Inference",
      "Web Search",
      "Function Calling",
      "Image Analysis",
      "Code Generation",
      "Embedding Generation",
    ],
    amountRange: [0.001, 0.05],
  },
  {
    name: "Data Pipeline Agent",
    wallet: "4vGrf6g5wGKDF3B9Xz3f7Y7nM7Q3F3eKJcW4BzH4W5Bh",
    dailyLimit: 0.5,
    categories: [
      "RPC Query",
      "Database Write",
      "IPFS Storage",
      "WebSocket Feed",
      "Data Extraction",
    ],
    amountRange: [0.0002, 0.01],
  },
];

const RECIPIENTS = [
  { name: "OpenAI", address: "GPnSi3WMWcw8d7Y4ZU5j7f9FmJ3WKqE2R4vZ5X6bY7Hg" },
  { name: "Anthropic", address: "HKqE2R4vZ5X6bY7Wg8iJ9k0Lm1N2O3P4Q5R6S7T8U9V" },
  { name: "Helius", address: "4Wg8iJ9k0Lm1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D" },
  { name: "Perplexity", address: "9k0Lm1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F" },
  { name: "Supabase", address: "Lm1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H" },
  { name: "Pinata IPFS", address: "2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2I3J" },
];

function generateLocalPayment(): PaymentRequest {
  const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
  const category = agent.categories[Math.floor(Math.random() * agent.categories.length)];
  const recipient = RECIPIENTS[Math.floor(Math.random() * RECIPIENTS.length)];
  const [min, max] = agent.amountRange;
  const amount = min + Math.random() * (max - min);

  const reasons: Record<string, string[]> = {
    "LLM Inference": [
      `GPT-4o-mini API call for market sentiment analysis`,
      `GPT-4o completion — multi-step reasoning task`,
      `GPT-4 Vision — image analysis for fraud detection`,
      `Code generation task — 2,400 tokens output`,
      `Function calling — tool orchestration for data pipeline`,
    ],
    "Web Search": [
      `Perplexity API — real-time market data query`,
      `Web search — competitor pricing analysis`,
      `News aggregation — 5 sources, sentiment scoring`,
    ],
    "Function Calling": [
      `Tool use orchestration — 3 API calls chained`,
      `Function call — database query + transformation + storage`,
    ],
    "Image Analysis": [
      `GPT-4 Vision — document OCR and extraction`,
      `Image classification — product defect detection`,
    ],
    "Code Generation": [
      `Code generation — Python ETL pipeline (800 tokens)`,
      `SQL query generation — analytics dashboard`,
    ],
    "Embedding Generation": [
      `text-embedding-3-small — 1,200 chunks indexed`,
      `Embedding batch — semantic search index update`,
    ],
    "RPC Query": [
      `Helius RPC — transaction history for wallet analysis`,
      `Solana RPC — account data lookup`,
    ],
    "Database Write": [
      `Supabase insert — 500 records from pipeline`,
      `Database update — agent state checkpoint`,
    ],
    "IPFS Storage": [
      `Pinata pin — dataset (12MB compressed)`,
      `IPFS storage — analysis results archival`,
    ],
    "WebSocket Feed": [
      `WebSocket subscription — real-time price feed`,
      `Stream connection — transaction monitoring`,
    ],
    "Data Extraction": [
      `Reserve credit — variable-cost web scraping (max 0.05 SOL)`,
      `Data extraction — SEC filing analysis (3 documents)`,
    ],
  };

  const reasonList = reasons[category] || [`${category} — automated agent operation`];
  const reason = reasonList[Math.floor(Math.random() * reasonList.length)];

  return {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    agentName: agent.name,
    amount: parseFloat(amount.toFixed(6)),
    recipient: `${recipient.address.slice(0, 4)}...${recipient.address.slice(-4)}`,
    reason,
    category,
    urgency: amount > 0.02 ? "high" : amount > 0.005 ? "medium" : "low",
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Try DeepSeek API first for AI-generated requests
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: `You generate realistic payment requests from autonomous AI agents. Each request represents an AI agent spending SOL to pay for API services. Be specific about the exact service, token count, and model. Return ONLY valid JSON, no other text. Amounts must be between 0.0002 and 0.05 SOL.`,
            },
            {
              role: "user",
              content: `Generate a payment request from one of these agents:
- GPT-4 Orchestrator (handles LLM calls, web search, code generation, embeddings)
- Data Pipeline Agent (handles data ops, RPC queries, database writes, IPFS storage)

Return JSON: {"agentName": string, "amount": number (0.0002-0.05 SOL), "reason": string (specific: model name, token count, purpose), "category": string, "urgency": "low"|"medium"|"high"}`,
            },
          ],
          max_tokens: 150,
          temperature: 0.9,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          // Try to parse the AI response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            // Clamp amount to realistic SOL range
            const amount = Math.min(0.05, Math.max(0.0002, parseFloat(parsed.amount) || 0.005));
            return res.status(200).json({
              id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              agentName: parsed.agentName || "GPT-4 Orchestrator",
              amount,
              recipient: `${RECIPIENTS[Math.floor(Math.random() * RECIPIENTS.length)].address.slice(0, 4)}...${RECIPIENTS[Math.floor(Math.random() * RECIPIENTS.length)].address.slice(-4)}`,
              reason: parsed.reason || "AI agent operation",
              category: parsed.category || "LLM Inference",
              urgency: parsed.urgency || "medium",
              source: "deepseek",
            });
          }
        }
      }
    } catch (e) {
      // Fall through to local generation
      console.error("[AgentPay] DeepSeek API error:", e);
    }
  }

  // Fallback: local simulation
  const payment = generateLocalPayment();
  return res.status(200).json({ ...payment, source: "local" });
}