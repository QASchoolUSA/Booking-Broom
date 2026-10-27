import { action } from "./_generated/server";
import { v } from "convex/values";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
/** Prefer SMS length; allow longer MMS text up to Voip.ms sendMMS max. */
const MESSAGE_MAX = 2048;

const SYSTEM_PROMPT = `You rewrite SMS/MMS drafts for a residential/commercial cleaning business manager texting clients.

Rules:
- Preserve the original meaning and any concrete details (names, times, addresses, prices).
- Professional, warm, and clear — not stiff or corporate.
- Plain text only. No markdown, bullets, emoji, or quotation marks around the whole message.
- Do not add a greeting or sign-off unless the draft already has one.
- Prefer concise wording. Stay under 160 characters when the draft is already short; otherwise keep under 2048 characters (MMS).
- Return ONLY the rewritten message, nothing else.`;

function cleanRewrite(raw: string): string {
  let text = raw.trim();
  // Strip wrapping quotes the model sometimes adds.
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/\s+/g, " ");
  if (text.length <= MESSAGE_MAX) return text;

  const sliced = text.slice(0, MESSAGE_MAX);
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > MESSAGE_MAX * 0.6) return sliced.slice(0, lastSpace).trim();
  return sliced.trim();
}

export const rewriteSmsDraft = action({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args): Promise<{ text: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const draft = args.text.trim();
    if (!draft) throw new Error("Nothing to rewrite");
    if (draft.length > MESSAGE_MAX) {
      throw new Error(`Draft is limited to ${MESSAGE_MAX} characters`);
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not set. Add it in Convex env (free key from console.groq.com)."
      );
    }

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: draft },
        ],
      }),
    });

    if (res.status === 429) {
      throw new Error("Groq rate limit hit — try again in a moment");
    }
    if (!res.ok) {
      let detail = `Groq request failed (${res.status})`;
      try {
        const errBody = (await res.json()) as {
          error?: { message?: string };
        };
        if (errBody.error?.message) detail = errBody.error.message;
      } catch {
        // ignore parse errors
      }
      throw new Error(detail);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content?.trim()) {
      throw new Error("Groq returned an empty rewrite");
    }

    return { text: cleanRewrite(content) };
  },
});
