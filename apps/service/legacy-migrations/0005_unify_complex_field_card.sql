UPDATE "models"
SET "schema" = replace(
  replace("schema", '"ObjectField"', '"Card"'),
  '"ArrayCards"',
  '"Card"'
)
WHERE "schema" LIKE '%"ObjectField"%'
   OR "schema" LIKE '%"ArrayCards"%';
