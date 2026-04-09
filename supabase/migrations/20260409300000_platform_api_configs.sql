-- Platform API Configurations
-- Central registry for all Vybrel edge functions so Vybrel Admin can manage
-- secrets, enable/disable, trigger manually, and monitor health.

CREATE TABLE IF NOT EXISTS public.platform_api_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name          TEXT NOT NULL UNIQUE,          -- edge function name (kebab-case)
  display_name      TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN (
                      'settlement', 'ledger', 'market_data', 'notifications',
                      'psp', 'auth', 'kyb', 'ai', 'communications', 'other'
                    )),
  description       TEXT,
  requires_secrets  TEXT[]   DEFAULT '{}',         -- Supabase secret names needed
  cron_schedule     TEXT,                          -- null = not scheduled
  is_active         BOOLEAN  DEFAULT true,
  verify_jwt        BOOLEAN  DEFAULT false,
  last_invoked_at   TIMESTAMPTZ,
  health_status     TEXT     DEFAULT 'unknown',    -- healthy | unhealthy | unknown
  health_message    TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_api_configs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage; authenticated users can read (for UI display)
CREATE POLICY "platform_api_admin_all" ON public.platform_api_configs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "platform_api_read" ON public.platform_api_configs
  FOR SELECT TO authenticated
  USING (true);

-- -----------------------------------------------------------------------
-- Seed all known edge functions
-- -----------------------------------------------------------------------
INSERT INTO public.platform_api_configs
  (api_name, display_name, category, description, requires_secrets, cron_schedule, is_active, verify_jwt)
VALUES
  -- Market Data
  ('fetch-market-rates', 'Fetch Market Rates',
   'market_data',
   'Fetches SOFR, SONIA, EURIBOR-3M and BOE reference rates from the FRED API (with static fallback). Upserts into reference_rates table.',
   ARRAY['FRED_API_KEY'],
   '0 7 * * 1-5',
   true, false),

  -- Settlement & Ledger
  ('generate-settlement', 'Generate Settlement Advice',
   'settlement',
   'Triggered on collection confirmation. Calculates borrower & funder settlement advices, posts balanced journal entries, creates payment instructions, and raises negative-margin alerts.',
   ARRAY[]::TEXT[],
   NULL,
   true, false),

  ('psp-webhook', 'PSP Webhook Handler',
   'psp',
   'Receives payment status callbacks from the PSP (Modulr, Railsr, or manual). Updates payment_instructions status and posts confirmation journal entries.',
   ARRAY['PSP_WEBHOOK_SECRET'],
   NULL,
   true, false),

  -- Communications
  ('notify-counterparty', 'Notify Counterparty',
   'communications',
   'Sends counterparty invoice verification email via Resend. Triggered when an invoice requiring counterparty acceptance is submitted.',
   ARRAY['RESEND_API_KEY', 'APP_URL'],
   NULL,
   true, false),

  ('send-message-email', 'Send Message Email',
   'communications',
   'Sends email notification when an in-platform message is received. Uses Resend. Gracefully skips if RESEND_API_KEY is not configured.',
   ARRAY['RESEND_API_KEY'],
   NULL,
   true, true),

  -- Auth
  ('custom-jwt-claims', 'Custom JWT Claims Hook',
   'auth',
   'Enriches JWTs with org_id, role, roles, and entity_id on every sign-in or token refresh. Must be registered as a Custom Access Token Hook in Supabase Auth settings.',
   ARRAY[]::TEXT[],
   NULL,
   true, false),

  ('accept-invitation', 'Accept Invitation',
   'auth',
   'Handles invitation acceptance flow. Creates user profile and assigns roles on first login via invitation link.',
   ARRAY[]::TEXT[],
   NULL,
   true, false),

  ('admin-manage-users', 'Admin Manage Users',
   'auth',
   'Admin-only function to create, update, disable, and assign roles to platform users. Bypasses RLS using service role.',
   ARRAY[]::TEXT[],
   NULL,
   true, false),

  -- KYB / Registry
  ('registry-lookup', 'Registry Lookup',
   'kyb',
   'Looks up a company in a configured registry (Companies House, ACRA, ASIC, etc.) using the registry_api_configs settings. Also handles health checks.',
   ARRAY[]::TEXT[],
   NULL,
   true, false),

  ('validation-lookup', 'Validation Lookup',
   'kyb',
   'Bank account, sort code, and IBAN validation via configured providers.',
   ARRAY[]::TEXT[],
   NULL,
   true, false),

  ('truelayer-name-verify', 'TrueLayer Name Verify',
   'kyb',
   'Verifies bank account owner name against company name using TrueLayer open banking.',
   ARRAY['TRUELAYER_CLIENT_ID', 'TRUELAYER_CLIENT_SECRET'],
   NULL,
   true, false),

  ('address-lookup', 'Address Lookup',
   'kyb',
   'Postcode and address lookup for onboarding forms.',
   ARRAY['GETADDRESS_API_KEY'],
   NULL,
   true, false),

  -- AI
  ('ai-credit-memo', 'AI Credit Memo',
   'ai',
   'Generates a credit memo draft using Claude AI based on borrower financials and KYB data.',
   ARRAY['ANTHROPIC_API_KEY'],
   NULL,
   true, false),

  ('ai-analyze-document', 'AI Document Analyser',
   'ai',
   'Analyses uploaded documents (bank statements, management accounts) and extracts structured data.',
   ARRAY['ANTHROPIC_API_KEY'],
   NULL,
   true, false),

  ('ai-analyze-invoice-docs', 'AI Invoice Document Analyser',
   'ai',
   'Performs OCR and structured extraction on invoice PDFs and images.',
   ARRAY['ANTHROPIC_API_KEY'],
   NULL,
   true, false),

  ('ai-match-invoice', 'AI Invoice Matcher',
   'ai',
   'Matches submitted invoices against counterparty records to detect duplicates or discrepancies.',
   ARRAY['ANTHROPIC_API_KEY'],
   NULL,
   true, false),

  ('ai-review-contract', 'AI Contract Reviewer',
   'ai',
   'Reviews MSA and contract documents against Vybrel clause standards and flags non-standard terms.',
   ARRAY['ANTHROPIC_API_KEY'],
   NULL,
   true, false),

  ('ai-validate-doc-type', 'AI Document Type Validator',
   'ai',
   'Classifies uploaded documents by type (bank statement, invoice, ID, etc.) before processing.',
   ARRAY['ANTHROPIC_API_KEY'],
   NULL,
   true, false),

  ('help-chatbot', 'Help Chatbot',
   'ai',
   'AI-powered in-platform help assistant. Answers questions about platform features and workflows.',
   ARRAY['ANTHROPIC_API_KEY'],
   NULL,
   true, false),

  -- Other
  ('workflow-engine', 'Workflow Engine',
   'other',
   'Processes the workflow_event_queue table. Routes events to appropriate handlers (sanctions checks, KYB triggers, notifications).',
   ARRAY[]::TEXT[],
   NULL,
   true, false),

  ('invoice-fraud-check', 'Invoice Fraud Check',
   'other',
   'Automated fraud screening on invoice submission. Checks for duplicate invoice numbers, suspicious amounts, and counterparty sanctions.',
   ARRAY[]::TEXT[],
   NULL,
   true, false),

  ('credit-committee-decide', 'Credit Committee Decision',
   'other',
   'Processes credit committee votes and applies facility approval/rejection when quorum is reached.',
   ARRAY[]::TEXT[],
   NULL,
   true, false),

  ('counterparty-verify', 'Counterparty Verify',
   'other',
   'Handles the public counterparty invoice acceptance/rejection flow (no auth required).',
   ARRAY[]::TEXT[],
   NULL,
   true, false),

  ('setup-test-users', 'Setup Test Users',
   'other',
   'Development-only function to seed test users with roles. Should be disabled in production.',
   ARRAY[]::TEXT[],
   NULL,
   false, false)

ON CONFLICT (api_name) DO NOTHING;
