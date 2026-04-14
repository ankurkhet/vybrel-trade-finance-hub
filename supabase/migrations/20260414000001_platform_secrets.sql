-- Platform Secrets: admin-configurable key-value store for API keys and external service secrets.
-- Edge functions read from here (with env var fallback) so admins can configure via the UI.

CREATE TABLE IF NOT EXISTS public.platform_secrets (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id)
);

ALTER TABLE public.platform_secrets ENABLE ROW LEVEL SECURITY;

-- Only admins can read or write secrets
CREATE POLICY "admin_read_secrets" ON public.platform_secrets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_write_secrets" ON public.platform_secrets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Update platform_api_configs: AI functions use OPENAI_API_KEY
UPDATE public.platform_api_configs
SET requires_secrets = ARRAY['OPENAI_API_KEY']
WHERE category = 'ai';

-- Add reconcile-bank-statement (also uses OpenAI)
UPDATE public.platform_api_configs
SET requires_secrets = ARRAY['OPENAI_API_KEY']
WHERE api_name = 'reconcile-bank-statement';
