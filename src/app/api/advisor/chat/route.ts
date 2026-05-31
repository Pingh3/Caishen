import { NextResponse } from "next/server";
import {
  latestSnapshot,
  snapshotMostLiquidNetWorth,
  snapshotNetWorth,
} from "@/lib/finance";
import { fetchFxRates, fetchQuotesForHoldings } from "@/lib/market";
import {
  buildMostLiquidAllocation,
  mergePortfolioHoldings,
} from "@/lib/most-liquid-allocation";
import { readFinanceData } from "@/lib/storage";

export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatBody = {
  messages?: ChatMessage[];
};

function sanitizeHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && !!m.content)
    .slice(-10)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 2000),
    }));
}

async function buildPortfolioContext(): Promise<string> {
  const data = await readFinanceData();
  const accounts = data.accounts.filter((a) => !a.archived);
  const latest = latestSnapshot(data);
  if (!latest) {
    return "No snapshot available yet.";
  }

  const fx = await fetchFxRates();
  const holdings = mergePortfolioHoldings(data);
  const quotes = await fetchQuotesForHoldings(holdings);
  const mostLiquid = buildMostLiquidAllocation(
    latest,
    accounts,
    holdings,
    quotes,
    fx,
    data.settings?.mostLiquidPlan,
  );

  const topSlices = mostLiquid.slices
    .map((s) => `${s.name}: ${s.pct.toFixed(1)}%`)
    .join(", ");

  return [
    `Date: ${latest.date}`,
    `Net worth SGD: ${Math.round(snapshotNetWorth(latest, accounts, data.insurancePolicies, data.personalLoans, data.vehicle, data.property))}`,
    `Most liquid net worth SGD: ${Math.round(snapshotMostLiquidNetWorth(latest, accounts))}`,
    `Most liquid breakdown: ${topSlices || "N/A"}`,
    `Stocks/funds current: ${mostLiquid.stocksFundsPct.toFixed(1)}% (target <= ${mostLiquid.targets.maxStocksFundsPct}%)`,
    `SG share within stocks/funds: ${mostLiquid.sgShareOfStocksFundsPct?.toFixed(1) ?? "N/A"}% (target ${mostLiquid.targets.sgShareOfStocksFundsPct}%)`,
    `Plan target SG of most-liquid at cap: ${mostLiquid.targets.sgStocksPctOfTotalAtPlan.toFixed(1)}%`,
    `Philosophy investing: ${data.philosophy?.investing ?? "Not provided"}`,
    `Philosophy trading: ${data.philosophy?.trading ?? "Not provided"}`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GROQ_API_KEY is missing. Add it in your environment variables and redeploy.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as ChatBody;
    const rawMessages = body.messages ?? [];
    const messages = sanitizeHistory(rawMessages);
    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Please send at least one message." },
        { status: 400 },
      );
    }

    const context = await buildPortfolioContext();

    const systemPrompt = [
      "You are a practical portfolio allocation coach for a Singapore investor.",
      "Use the portfolio context to answer questions about whether allocations are too high or too low.",
      "Give direct, concise guidance with concrete percentage ranges and step-by-step adjustments.",
      "Respect user targets for stocks/funds cap and SG share within stocks/funds.",
      "Do not claim certainty; mention uncertainty where data is missing.",
      "This is educational, not financial advice.",
      "Portfolio context:\n" + context,
    ].join("\n");

    const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return NextResponse.json(
        { error: `Groq error: ${errorText}` },
        { status: 502 },
      );
    }

    const json = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "Groq returned an empty response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply: content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
