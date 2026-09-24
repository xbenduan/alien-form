-- Align legacy category record IDs with the code-owned system model constants.
-- The update is conditional so it remains safe on fresh databases.
UPDATE "_sys_model_category"
SET "id" = 'SYSCATEGORY000001'
WHERE "id" = 'SYSTAB000001'
  AND "code" = 'all';

UPDATE "_sys_model_category"
SET "id" = 'SYSCATEGORY000002'
WHERE "id" = 'SYSTAB000002'
  AND "code" = 'system';

UPDATE "_sys_model_category"
SET "id" = 'SYSCATEGORY000003'
WHERE "id" = 'SYSTAB000003'
  AND "code" = 'other';
