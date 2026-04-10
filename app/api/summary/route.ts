import { NextResponse } from "next/server";
import { formatCompactNumber, formatCurrency, formatPercent } from "@/lib/format";
import { isSummaryMetrics, type SummaryMetrics } from "@/lib/ai-summary";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
const FALLBACK_MODELS = [
  "qwen/qwen3.6-plus:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "openrouter/free",
];

function buildPrompt(series: SummaryMetrics) {
  const movement = series.mnavChange >= 0 ? "expanded" : "compressed";

  return [
    "Write a short dashboard assessment.",
    "Rules:",
    "1. Write 4 to 5 sentences only.",
    `2. Say clearly that mNAV ${movement} over the selected range.`,
    "3. Use only the metrics below.",
    "4. Compare mNAV with BTC price, MSTR price, and BTC holdings using the provided numbers.",
    "5. Include an overall evaluation of what the metrics collectively show.",
    "6. You may explain potential reasons or interactions between mNAV and the other metrics, but only as possibilities supported by the numbers provided.",
    '7. If you mention possible reasons, use cautious wording such as "may reflect", "could indicate", or "is consistent with".',
    "8. Do not mention outside news, catalysts, or facts that are not provided in the metrics.",
    "9. Do not give investment advice.",
    "10. Keep the tone analytical, useful, and concise.",
    "11. Avoid repeating the same comparison or conclusion twice.",
    '12. End with this exact sentence: "AI-generated commentary, not investment advice."',
    "13. Return plain text only.",
    "",
    "Metrics:",
    `Range: ${series.range}`,
    `Latest trading date: ${series.latestTradingDate}`,
    `Latest mNAV: ${series.latestMnav.toFixed(2)}x`,
    `mNAV change: ${formatPercent(series.mnavChange)} (${movement})`,
    `Latest BTC price: ${formatCurrency(series.latestBtcPrice)}`,
    `BTC price change: ${formatPercent(series.btcPriceChange)}`,
    `Latest MSTR price: ${formatCurrency(series.latestStockPrice)}`,
    `MSTR price change: ${formatPercent(series.stockPriceChange)}`,
    `Latest BTC holdings: ${formatCompactNumber(series.latestBtcHoldings)} BTC`,
    `BTC holdings change: ${formatPercent(series.btcHoldingsChange)}`,
  ].join("\n");
}

function extractSummary(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return candidate.choices?.[0]?.message?.content?.trim() || null;
}

function extractProviderError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as {
    error?: {
      message?: string;
      code?: string | number;
    };
    message?: string;
  };

  if (candidate.error?.message) return candidate.error.message;
  if (candidate.message) return candidate.message;

  return null;
}

function getModelCandidates() {
  const candidates = [DEFAULT_MODEL, ...FALLBACK_MODELS];
  return candidates.filter((model, index) => candidates.indexOf(model) === index);
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { range, series } = body as { range?: unknown; series?: unknown };

  if (typeof range !== "string" || !isSummaryMetrics(series) || range !== series.range) {
    return NextResponse.json({ error: "Invalid summary payload." }, { status: 400 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "AI summaries are unavailable because OPENROUTER_API_KEY is not configured." },
      { status: 503 },
    );
  }

  try {
    let lastErrorMessage = "The AI provider could not generate a summary.";

    for (const model of getModelCandidates()) {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
          "X-Title": "DAT.co mNAV Monitor",
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 260,
          messages: [
            {
              role: "system",
              content: "Follow the user's formatting rules exactly. Be brief, literal, and numeric.",
            },
            {
              role: "user",
              content: buildPrompt(series),
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as unknown;
        const providerMessage = extractProviderError(errorPayload);
        lastErrorMessage =
          providerMessage || `The AI provider could not generate a summary with ${model} (status ${response.status}).`;
        continue;
      }

      const payload = (await response.json()) as unknown;
      const summary = extractSummary(payload);

      if (!summary) {
        lastErrorMessage = `The AI provider returned an empty summary for ${model}.`;
        continue;
      }

      return NextResponse.json({
        summary,
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: lastErrorMessage }, { status: 502 });
  } catch {
    return NextResponse.json(
      { error: "The AI provider request failed." },
      { status: 502 },
    );
  }
}
