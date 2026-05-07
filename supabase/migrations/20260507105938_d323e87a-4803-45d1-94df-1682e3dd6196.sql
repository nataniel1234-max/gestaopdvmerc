
-- 1. Add superadmin role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'superadmin';
