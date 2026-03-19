
ALTER TABLE public.registry_api_configs
  ADD COLUMN IF NOT EXISTS registry_type text NOT NULL DEFAULT 'rest',
  ADD COLUMN IF NOT EXISTS ckan_dataset_id text,
  ADD COLUMN IF NOT EXISTS ckan_resource_id text,
  ADD COLUMN IF NOT EXISTS ckan_search_action text DEFAULT 'package_search',
  ADD COLUMN IF NOT EXISTS ckan_show_action text DEFAULT 'package_show',
  ADD COLUMN IF NOT EXISTS ckan_query_field_mapping jsonb DEFAULT '{}';
