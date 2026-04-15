-- Add GEMINI_API_KEY and AI_ENGINE to platform_secrets
-- AI_ENGINE controls which provider all AI edge functions use (openai | gemini)

INSERT INTO public.platform_secrets (key, value, description)
VALUES
  ('AI_ENGINE',     'gemini',  'AI engine to use for all AI functions: "openai" (default) or "gemini"'),
  ('GEMINI_API_KEY', 'AIzaSyAPUHezhj61Z1aTkPfM_x9lRa58SNKxM_Y', 'Google Gemini API key — used when AI_ENGINE=gemini')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = now();

-- Update requires_secrets for AI functions to reflect both supported engines
UPDATE public.platform_api_configs
SET requires_secrets = ARRAY['OPENAI_API_KEY or GEMINI_API_KEY', 'AI_ENGINE']
WHERE category = 'ai';

UPDATE public.platform_api_configs
SET requires_secrets = ARRAY['OPENAI_API_KEY or GEMINI_API_KEY', 'AI_ENGINE']
WHERE api_name = 'reconcile-bank-statement';
