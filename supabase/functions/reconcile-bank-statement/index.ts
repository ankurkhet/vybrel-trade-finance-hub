/**
 * reconcile-bank-statement
 *
 * Parses a bank statement (CSV or PDF) and auto-matches lines to payment_instructions.
 * Also used by the disbursement advice flow (Gap 1) to confirm a specific transaction.
 * PSP day-end batches call this with pre-parsed JSON transactions.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAIClient } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version",
};

interface ParsedLine {
  date: string;       // ISO date string
  amount: number;     // positive = credit, negative = debit
  description: string;
  reference: string;
  raw_line?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const {
      bank_statement_upload_id,
      disbursement_advice_id,
      disbursement_amount,
    } = body;

    if (!bank_statement_upload_id) {
      return new Response(
        JSON.stringify({ healthy: true, mode: "health_check" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 1. Fetch the upload record ──────────────────────────────────────────
    const { data: upload, error: uploadErr } = await supabase
      .from("bank_statement_uploads")
      .select("*")
      .eq("id", bank_statement_upload_id)
      .single();

    if (uploadErr || !upload) {
      return errorResponse(`Upload not found: ${uploadErr?.message}`);
    }

    await supabase
      .from("bank_statement_uploads")
      .update({ status: "processing" })
      .eq("id", bank_statement_upload_id);

    // ── 2. Parse the file ───────────────────────────────────────────────────
    let parsedLines: ParsedLine[] = [];

    if (upload.file_type === "psp_auto" && upload.parsed_lines) {
      // PSP day-end batch: already parsed
      parsedLines = upload.parsed_lines as ParsedLine[];
    } else if (upload.file_path) {
      // Download file from storage
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("bank-statements")
        .download(upload.file_path);

      if (dlErr || !fileData) {
        throw new Error(`Failed to download file: ${dlErr?.message}`);
      }

      if (upload.file_type === "csv") {
        parsedLines = await parseCsv(fileData);
      } else if (upload.file_type === "pdf") {
        parsedLines = await parsePdfWithAi(fileData);
      }
    }

    // Save parsed lines
    await supabase
      .from("bank_statement_uploads")
      .update({
        parsed_lines: parsedLines,
        total_lines: parsedLines.length,
      })
      .eq("id", bank_statement_upload_id);

    // ── 3. Fetch payment instructions for matching ──────────────────────────
    const { data: instructions } = await supabase
      .from("payment_instructions")
      .select("id, amount, currency, psp_reference, created_at, status")
      .in("status", ["submitted", "pending", "confirmed"])
      .order("created_at", { ascending: false });

    // ── 4. Match each line ──────────────────────────────────────────────────
    let matchedCount = 0;
    let unmatchedCount = 0;

    const matchRows: any[] = [];

    for (let i = 0; i < parsedLines.length; i++) {
      const line = parsedLines[i];
      const lineAmount = Math.abs(line.amount);

      const match = findBestMatch(line, lineAmount, instructions || []);

      matchRows.push({
        organization_id: upload.organization_id,
        bank_statement_upload_id,
        statement_line_index: i,
        statement_date: line.date,
        statement_amount: lineAmount,
        statement_reference: line.reference,
        statement_description: line.description,
        payment_instruction_id: match?.instruction.id || null,
        match_type: match ? "auto_matched" : "unmatched",
        match_confidence: match?.confidence || null,
        match_notes: match?.note || null,
      });

      if (match) matchedCount++;
      else unmatchedCount++;
    }

    if (matchRows.length > 0) {
      await supabase.from("reconciliation_matches").insert(matchRows);
    }

    // ── 5. If this is for a specific disbursement advice, find that match ───
    let adviceMatchResult: any = null;
    if (disbursement_advice_id && disbursement_amount) {
      const targetAmount = Number(disbursement_amount);
      const bestMatch = matchRows
        .filter(r => r.match_type === "auto_matched" &&
          Math.abs(r.statement_amount - targetAmount) < 0.02)
        .sort((a, b) => (b.match_confidence || 0) - (a.match_confidence || 0))[0];

      adviceMatchResult = {
        matched: !!bestMatch,
        confidence: bestMatch?.match_confidence || null,
        statement_date: bestMatch?.statement_date || null,
        statement_amount: bestMatch?.statement_amount || null,
        statement_reference: bestMatch?.statement_reference || null,
      };

      await supabase
        .from("disbursement_advices")
        .update({ ai_match_result: adviceMatchResult })
        .eq("id", disbursement_advice_id);
    }

    // ── 6. Update upload status ─────────────────────────────────────────────
    await supabase
      .from("bank_statement_uploads")
      .update({
        status: "processed",
        matched_lines: matchedCount,
        unmatched_lines: unmatchedCount,
        processed_at: new Date().toISOString(),
      })
      .eq("id", bank_statement_upload_id);

    return jsonResponse({
      total: parsedLines.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      advice_match: adviceMatchResult,
    });
  } catch (err: any) {
    console.error("[reconcile-bank-statement] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});

// ── CSV Parser ────────────────────────────────────────────────────────────────

async function parseCsv(file: Blob): Promise<ParsedLine[]> {
  const text = await file.text();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.toLowerCase().replace(/[^a-z]/g, ""));

  // Detect column indices heuristically
  const dateIdx = findHeaderIdx(headers, ["date", "valuedate", "txdate", "transactiondate"]);
  const amountIdx = findHeaderIdx(headers, ["amount", "credit", "debit", "value"]);
  const descIdx = findHeaderIdx(headers, ["description", "narrative", "details", "paymentdetails"]);
  const refIdx = findHeaderIdx(headers, ["reference", "ref", "paymentref", "transactionref"]);

  const result: ParsedLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    const rawDate = dateIdx >= 0 ? cols[dateIdx] : "";
    const rawAmount = amountIdx >= 0 ? cols[amountIdx] : "0";
    const desc = descIdx >= 0 ? cols[descIdx] : cols.slice(1).join(" ");
    const ref = refIdx >= 0 ? cols[refIdx] : "";

    const parsedDate = parseDate(rawDate);
    const parsedAmount = parseFloat(rawAmount.replace(/[^0-9.\-]/g, "")) || 0;

    if (parsedDate) {
      result.push({
        date: parsedDate,
        amount: parsedAmount,
        description: desc.trim(),
        reference: ref.trim(),
        raw_line: lines[i],
      });
    }
  }

  return result;
}

function findHeaderIdx(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { result.push(current); current = ""; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  // Try ISO first
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // DD/MM/YYYY or DD-MM-YYYY
  const m = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // MM/DD/YYYY (US)
  const us = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    // Heuristic: if day > 12, it's definitely DD/MM; otherwise assume DD/MM for UK banks
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  return null;
}

// ── PDF Parser (via AI) ───────────────────────────────────────────────────────

async function parsePdfWithAi(file: Blob): Promise<ParsedLine[]> {
  const _admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  
  const ai = await createAIClient(_admin).catch(err => {
    console.warn("[reconcile] Could not init AI client:", err.message);
    return null;
  });
  
  if (!ai) return [];

  // Convert to base64
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const systemPrompt = "You are a data extraction assistant.";
  const userPrompt = `Extract all bank transaction rows from this bank statement as a JSON array.
Each item must have these fields:
- date: ISO date string (YYYY-MM-DD)
- amount: number (positive = credit/money in, negative = debit/money out)
- description: transaction narrative
- reference: payment reference or transaction ID if available, else empty string

Return ONLY the JSON array, no other text. Example:
[{"date":"2026-04-10","amount":-5000.00,"description":"Payment to Acme Ltd","reference":"BACS-123"}]`;

  try {
    const rawText = await ai.analyzeDocument(systemPrompt, userPrompt, base64, "application/pdf", { maxTokens: 4096 });
    const cleaned = rawText.replace(/^```json?\n?/i, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as ParsedLine[];
  } catch (err: any) {
    console.error("[reconcile] Failed to parse PDF with AI:", err.message);
    return [];
  }
}

// ── Matching Logic ────────────────────────────────────────────────────────────

function findBestMatch(
  line: ParsedLine,
  lineAmount: number,
  instructions: any[]
): { instruction: any; confidence: number; note: string } | null {
  const lineDate = line.date ? new Date(line.date).getTime() : null;
  const lineRef = (line.reference || "").toLowerCase();
  const lineDesc = (line.description || "").toLowerCase();

  let best: { instruction: any; confidence: number; note: string } | null = null;

  for (const inst of instructions) {
    const instAmount = Math.abs(Number(inst.amount));
    const instRef = (inst.psp_reference || "").toLowerCase();
    const instDate = inst.created_at ? new Date(inst.created_at).getTime() : null;

    // Amount must match within £0.02
    if (Math.abs(instAmount - lineAmount) > 0.02) continue;

    let confidence = 50; // base: amount matches
    let note = "Amount match";

    // Reference match
    if (instRef && lineRef && (lineRef.includes(instRef) || instRef.includes(lineRef) ||
        lineDesc.includes(instRef))) {
      confidence += 40;
      note = "Amount + reference match";
    }

    // Date proximity (within 3 business days)
    if (lineDate && instDate) {
      const daysDiff = Math.abs(lineDate - instDate) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 1) confidence += 10;
      else if (daysDiff <= 3) confidence += 5;
      else if (daysDiff > 7) confidence -= 20;
    }

    if (!best || confidence > best.confidence) {
      best = { instruction: inst, confidence: Math.min(100, confidence), note };
    }
  }

  // Only return if confidence is meaningful
  return best && best.confidence >= 50 ? best : null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
