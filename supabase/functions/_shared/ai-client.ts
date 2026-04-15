/**
 * Unified AI Client for Vybrel Edge Functions
 * Supports: OpenAI (gpt-4o-mini) and Google Gemini (gemini-2.0-flash)
 * 
 * Usage:
 *   const ai = await createAIClient(adminClient);
 *   const text = await ai.complete(systemPrompt, userPrompt);
 *   const json = await ai.completeJSON(systemPrompt, userPrompt, schema); // OpenAI function-calling / Gemini JSON mode
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AIClient {
  engine: "openai" | "gemini";
  complete(systemPrompt: string, userPrompt: string, opts?: { maxTokens?: number; temperature?: number }): Promise<string>;
  completeMessages(messages: AIMessage[], opts?: { maxTokens?: number; temperature?: number }): Promise<string>;
  analyzeDocument(systemPrompt: string, userPrompt: string, base64: string, mimeType: string, opts?: { maxTokens?: number; temperature?: number }): Promise<string>;
}

async function getSecret(admin: ReturnType<typeof createClient>, key: string): Promise<string | null> {
  const envVal = Deno.env.get(key);
  if (envVal) return envVal;
  const { data } = await admin.from("platform_secrets").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

export async function createAIClient(admin: ReturnType<typeof createClient>): Promise<AIClient> {
  // Determine engine — default to "openai"
  const engine = ((await getSecret(admin, "AI_ENGINE")) || "openai").toLowerCase() as "openai" | "gemini";

  if (engine === "gemini") {
    const apiKey = await getSecret(admin, "GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured. Set it in Admin → Registry APIs → Secrets.");

    const geminiCall = async (systemPrompt: string, messages: AIMessage[], opts?: { maxTokens?: number; temperature?: number }): Promise<string> => {
      // Build Gemini contents from messages (exclude system role—pass as system_instruction)
      const contents = messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }));

      const body: Record<string, unknown> = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: opts?.temperature ?? 0.3,
          maxOutputTokens: opts?.maxTokens ?? 4096,
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429) throw new Error("Gemini rate limited — try again shortly");
        if (res.status === 403) throw new Error("GEMINI_API_KEY is invalid or missing Gemini API access");
        throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    };

    return {
      engine: "gemini",
      async complete(systemPrompt, userPrompt, opts) {
        return geminiCall(systemPrompt, [{ role: "user", content: userPrompt }], opts);
      },
      async completeMessages(messages, opts) {
        const systemMsg = messages.find(m => m.role === "system")?.content ?? "";
        const rest = messages.filter(m => m.role !== "system");
        return geminiCall(systemMsg, rest, opts);
      },
      async analyzeDocument(systemPrompt, userPrompt, base64, mimeType, opts) {
        const body: Record<string, unknown> = {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            role: "user",
            parts: [
              { text: userPrompt },
              { inlineData: { mimeType, data: base64 } }
            ]
          }],
          generationConfig: {
            temperature: opts?.temperature ?? 0.3,
            maxOutputTokens: opts?.maxTokens ?? 4096,
          }
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 429) throw new Error("Gemini rate limited");
          throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      }
    };
  }

  // Default: OpenAI
  const apiKey = await getSecret(admin, "OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured. Set it in Admin → Registry APIs → Secrets.");

  const openaiCall = async (messages: AIMessage[], opts?: { maxTokens?: number; temperature?: number }): Promise<string> => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: opts?.temperature ?? 0.3,
        max_tokens: opts?.maxTokens ?? 4096,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("OpenAI rate limited — try again shortly");
      if (res.status === 402) throw new Error("OpenAI credits exhausted — add billing at platform.openai.com");
      if (res.status === 401) throw new Error("OPENAI_API_KEY is invalid");
      throw new Error(`OpenAI error ${res.status}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  };

  return {
    engine: "openai",
    async complete(systemPrompt, userPrompt, opts) {
      return openaiCall([{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], opts);
    },
    async completeMessages(messages, opts) {
      return openaiCall(messages, opts);
    },
    async analyzeDocument(systemPrompt, userPrompt, base64, mimeType, opts) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
              ]
            }
          ],
          temperature: opts?.temperature ?? 0.3,
          max_tokens: opts?.maxTokens ?? 4096,
        }),
      });

      if (!res.ok) {
        if (res.status === 429) throw new Error("OpenAI rate limited");
        throw new Error(`OpenAI error ${res.status}`);
      }

      const data = await res.json();
      return data?.choices?.[0]?.message?.content ?? "";
    }
  };
}
