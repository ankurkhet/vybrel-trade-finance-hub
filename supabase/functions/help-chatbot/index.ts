import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.99.1/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { question, roles, conversationHistory } = body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rolesStr = (roles || []).join(", ") || "none";

    const systemPrompt = `You are Vybrel's AI Help Assistant. You help users navigate and use the Vybrel Trade Finance Platform.

The user currently has these roles: ${rolesStr}

## Role Permissions Quick Reference:
- **admin**: Platform governance — manage all orgs, users, workflows, registry APIs, audit logs
- **originator_admin**: Manages borrower lifecycle, invoices, credit committee, disbursements, funder relationships, branding
- **originator_user**: Read-only originator access to reports and AI insights
- **account_manager**: View borrowers, contracts, invoices, KYC docs
- **operations_manager**: Collections, disbursements, repayments processing
- **credit_committee_member**: Review credit applications, vote approve/reject/request info
- **borrower**: Self-service onboarding, invoice submission, document uploads
- **funder**: KYC onboarding, marketplace bidding, portfolio monitoring
- **broker_admin**: Introduces and manages borrowers, read-only fee config

## Key Platform Workflows:
1. **Borrower Onboarding**: Originator invites borrower → Borrower completes KYC wizard → Originator reviews documents → Approved
2. **Invoice Financing**: Borrower submits invoice → AI analysis → Originator reviews → Credit Committee approval → Refer to Funder → Funder approves limit → Disbursement
3. **Credit Committee**: Originator creates application → Committee members vote → Quorum reached → Decision (approve/reject) → If approved, refer to funder
4. **Funder Onboarding**: Originator invites funder → Funder completes KYC → MSA signed → Funder appears in relationships
5. **Lender Management**: Originator manages funders via Lender Management page → Set MSA terms (base rate, margins per product) → Refer borrower limits
6. **Collections & Settlements**: Track repayments, generate settlement advices

## Important Rules:
- If the user asks about something their current roles do NOT permit, clearly state: "This action requires the [specific role] role. Please contact your administrator to request this role."
- Be concise and practical. Give step-by-step navigation instructions.
- Reference specific menu items and page names.
- Never reveal technical details like database tables, RLS policies, or edge functions.
- Always be helpful and professional.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []).map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: question },
    ];

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        max_tokens: 1024,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Help chatbot error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
