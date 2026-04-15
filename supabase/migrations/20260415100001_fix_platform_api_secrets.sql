-- Fix requires_secrets for AI functions: code uses OPENAI_API_KEY not ANTHROPIC_API_KEY
-- Also correct reconcile-bank-statement which also uses OpenAI

UPDATE public.platform_api_configs
SET requires_secrets = ARRAY['OPENAI_API_KEY']
WHERE category = 'ai'
  AND (requires_secrets IS NULL
    OR requires_secrets = '{}'::TEXT[]
    OR 'ANTHROPIC_API_KEY' = ANY(requires_secrets));

UPDATE public.platform_api_configs
SET requires_secrets = ARRAY['OPENAI_API_KEY']
WHERE api_name = 'reconcile-bank-statement';

-- Functions that require no secrets should have empty array (not null)
UPDATE public.platform_api_configs
SET requires_secrets = '{}'::TEXT[]
WHERE requires_secrets IS NULL;
