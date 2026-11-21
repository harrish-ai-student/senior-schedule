import { ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { extractEvent, GeminiNotConfiguredError } from "@/lib/gemini";
import { ParseRequestSchema, ParseResultSchema, MAX_PARSE_TEXT } from "@/lib/schema";

// Do not log request text or model output anywhere in this file: events can contain medical information.

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
/** Leaves room inside the browser's 10-second limit. */
const AI_TIMEOUT_MS = 9_000;

// In-memory, per server instance. Good enough to stop accidental floods.
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing without bound.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { text?: unknown }).text === "string" &&
    (body as { text: string }).text.length > MAX_PARSE_TEXT
  ) {
    return NextResponse.json({ error: "too_long" }, { status: 413 });
  }

  const parsedReq = ParseRequestSchema.safeParse(body);
  if (!parsedReq.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await extractEvent(parsedReq.data, AbortSignal.timeout(AI_TIMEOUT_MS));
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "parse_failed" }, { status: 422 });
    }
    if (err instanceof ApiError) {
      // Status code only: the message is not logged in case it echoes the request.
      const hint =
        err.status === 400 || err.status === 401 || err.status === 403
          ? " Check GEMINI_API_KEY."
          : err.status === 404
            ? " Check GEMINI_MODEL is a current model name."
            : "";
      console.warn(`[api/parse] Gemini returned HTTP ${err.status}.${hint}`);
    }
    return NextResponse.json({ error: "ai_unavailable" }, { status: 502 });
  }

  const result = ParseResultSchema.safeParse(raw);
  if (!result.success) {
    return NextResponse.json({ error: "parse_failed" }, { status: 422 });
  }
  return NextResponse.json(result.data);
}
