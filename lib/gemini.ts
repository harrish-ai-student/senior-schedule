// Server-only: talks to Gemini with the secret key. Never import this from a client component.
import { GoogleGenAI, ThinkingLevel, Type, type Schema } from "@google/genai";
import type { ParseRequest } from "./schema";

export class GeminiNotConfiguredError extends Error {}

let warnedNotConfigured = false;

function systemInstruction(nowISO: string, timezone: string): string {
  return `You extract exactly one calendar event from text written or spoken by an elderly person.
The text may be in English, Malay, Simplified Chinese or Tamil, and may mix languages.
Current local date and time: ${nowISO}. Timezone: ${timezone}.
Return only JSON that matches the schema. No explanation.

Rules:
- Resolve relative dates from the current date: today, tomorrow, the day after tomorrow, "next Tuesday", "this Friday", "in 3 days".
- A bare weekday means its next occurrence on or after today.
- Time words: morning = 09:00, afternoon = 14:00, evening = 18:00, night = 20:00. Only use these when no exact time is given.
- Convert all times to 24-hour HH:mm.
- Never invent a date, time or title. If a value is not stated or cannot be worked out, set it to null and list it in "missing".
- title: short and plain, written in the same language as the input. Do not include the date or time in the title.
- category: health = doctor, clinic, hospital, medicine, therapy, exercise, walking, gym. social = meeting friends or family, visits, prayers, temple, mosque, church, community events. education = class, course, lesson, workshop. other = everything else. If an event fits more than one, health wins.
- place: location or the person being met, if stated, otherwise null.`;
}

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      nullable: true,
      maxLength: "60",
      description: "Short and plain, in the same language as the input. No date or time words.",
    },
    category: { type: Type.STRING, enum: ["health", "social", "education", "other"] },
    date: { type: Type.STRING, nullable: true, description: "YYYY-MM-DD" },
    time: { type: Type.STRING, nullable: true, description: "HH:mm, 24-hour" },
    place: { type: Type.STRING, nullable: true },
    missing: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: ["title", "date", "time"] },
    },
  },
  required: ["title", "category", "date", "time", "place", "missing"],
  propertyOrdering: ["title", "category", "date", "time", "place", "missing"],
};

/**
 * Asks Gemini to extract one event. Returns the parsed JSON (not yet validated)
 * or throws. Nothing here logs the text or the response: events may be medical.
 */
export async function extractEvent(req: ParseRequest, signal: AbortSignal): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) {
    // A setup problem, so say so once in the server log (never the user's text).
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.warn(
        `[api/parse] Gemini is not set up: ${!apiKey ? "GEMINI_API_KEY" : "GEMINI_MODEL"} is missing. ` +
          "Add it to .env.local (or the Vercel project settings) and restart. Typing and speaking will fall back to the Manual form until then.",
      );
    }
    throw new GeminiNotConfiguredError();
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: req.text,
    config: {
      systemInstruction: systemInstruction(req.nowISO, req.timezone),
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
      // Gemini 3 models think by default; keep it short so replies fit the 10-second limit.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      abortSignal: signal,
    },
  });
  const text = response.text;
  if (!text) return null;
  return JSON.parse(text);
}
