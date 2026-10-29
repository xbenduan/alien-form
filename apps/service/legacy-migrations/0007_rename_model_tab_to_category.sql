-- Rename the persisted model metadata. The dynamically-created physical table
-- is renamed by bootstrap because it does not exist yet on a fresh database.
UPDATE "models"
SET
  "name" = '_sys_model_category',
  "title" = '分类标签',
  "table_name" = '_sys_model_category',
  "schema" = json_set(
    replace("schema", '_sys_model_tab', '_sys_model_category'),
    '$.name',
    '_sys_model_category',
    '$.title',
    '分类标签',
    '$.subtitle',
    'Model Categories',
    '$.description',
    '模型分类标签与模型归属配置。',
    '$.singularLabel',
    '分类标签',
    '$.pluralLabel',
    '分类标签'
  )
WHERE "name" = '_sys_model_tab';

-- Rewrite references held by other model protocols.
UPDATE "models"
SET "schema" = replace("schema", '_sys_model_tab', '_sys_model_category')
WHERE "schema" LIKE '%_sys_model_tab%';
