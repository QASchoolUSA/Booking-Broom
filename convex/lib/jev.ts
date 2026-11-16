/**
 * TypeSafe System One (Jev) client for typed lead / email judgments.
 * POST https://api.typesafe.ai/v1/systemone — fail open; never throw into product paths.
 */

const API = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";

/** Choice/Score confidence at or above this is decisive. */
export const JEV_ACT = 0.8;
/** Noul decisive yes / no bands (Noul has no separate confidence). */
export const JEV_YES = 0.8;
export const JEV_NO = 0.2;

export type JevChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type JevScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

export type JevNoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
};

export type JevQuestion =
  | JevChoiceQuestion
  | JevScoreQuestion
  | JevNoulQuestion;

export type JevChoiceAnswer = {
  choice: string;
  confidence: number;
  probabilities?: Record<string, number>;
};

export type JevScoreAnswer = {
  score: number;
  confidence: number;
  probabilities?: Record<string, number>;
};

export type JevNoulAnswer = {
  noul: number;
};

export type JevAnswer = JevChoiceAnswer | JevScoreAnswer | JevNoulAnswer;

export type JevDecideResult = {
  ok: true;
  answers: Record<string, JevAnswer>;
  model?: string;
  inputTokens?: number;
} | {
  ok: false;
  reason: string;
};

export function choice(
  instructions: string,
  criteria: Record<string, string>
): JevChoiceQuestion {
  return { type: "choice", instructions, criteria };
}

export function score(instructions: string, criteria: string[]): JevScoreQuestion {
  return { type: "score", instructions, criteria };
}

export function noul(
  instructions: string,
  trueLabel: string,
  falseLabel: string
): JevNoulQuestion {
  return {
    type: "noul",
    instructions,
    criteria: { true: trueLabel, false: falseLabel },
  };
}

export function isDecisiveChoice(confidence: number | undefined): boolean {
  return (confidence ?? 0) >= JEV_ACT;
}

export function isDecisiveScore(confidence: number | undefined): boolean {
  return (confidence ?? 0) >= JEV_ACT;
}

export function isDecisiveYes(noulValue: number | undefined): boolean {
  return (noulValue ?? 0.5) >= JEV_YES;
}

export function isDecisiveNo(noulValue: number | undefined): boolean {
  return (noulValue ?? 0.5) <= JEV_NO;
}

function apiKey(): string | undefined {
  return (
    process.env.TYPESAFE_API_KEY?.trim() ||
    process.env.JEV_KEY?.trim() ||
    undefined
  );
}

export function jevConfigured(): boolean {
  return Boolean(apiKey());
}

/**
 * One System One request. Returns ok:false on missing key, HTTP errors, or malformed answers.
 */
export async function decide(
  state: Record<string, unknown>,
  questions: Record<string, JevQuestion>,
  options?: { timeoutMs?: number }
): Promise<JevDecideResult> {
  const key = apiKey();
  if (!key) {
    return { ok: false, reason: "env_missing" };
  }

  const timeoutMs = options?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        state,
        model: MODEL,
        questions,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        reason: `http_${response.status}:${body.slice(0, 120)}`,
      };
    }

    const data = (await response.json()) as {
      answers?: Record<string, JevAnswer>;
      model?: string;
      usage?: { input_tokens?: number };
    };

    const answers = data.answers ?? {};
    for (const id of Object.keys(questions)) {
      if (!(id in answers)) {
        return { ok: false, reason: `missing_answer_${id}` };
      }
    }

    return {
      ok: true,
      answers,
      model: data.model,
      inputTokens:
        typeof data.usage?.input_tokens === "number"
          ? data.usage.input_tokens
          : undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "jev_request_failed";
    return { ok: false, reason: message };
  } finally {
    clearTimeout(timer);
  }
}

export function asChoice(
  answer: JevAnswer | undefined
): JevChoiceAnswer | undefined {
  if (!answer || !("choice" in answer)) return undefined;
  return answer;
}

export function asScore(
  answer: JevAnswer | undefined
): JevScoreAnswer | undefined {
  if (!answer || !("score" in answer)) return undefined;
  return answer;
}

export function asNoul(
  answer: JevAnswer | undefined
): JevNoulAnswer | undefined {
  if (!answer || !("noul" in answer)) return undefined;
  return answer;
}
