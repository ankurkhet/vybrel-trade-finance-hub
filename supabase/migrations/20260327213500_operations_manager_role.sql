-- add_operations_manager_role.sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'operations_manager';
