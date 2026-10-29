UPDATE "models"
SET "schema" = json_set(
  "schema",
  '$.pages',
  json(
    (
      SELECT json_group_array(
        json(
          CASE
            WHEN json_type(page.value, '$.permission') IS NOT NULL THEN page.value
            ELSE json_set(
              page.value,
              '$.permission',
              CASE json_extract(page.value, '$.router')
                WHEN 'add' THEN 'create'
                WHEN 'edit' THEN 'update'
                ELSE 'read'
              END
            )
          END
        )
      )
      FROM json_each("models"."schema", '$.pages') AS page
    )
  )
)
WHERE json_type("schema", '$.pages') = 'array'
  AND EXISTS (
    SELECT 1
    FROM json_each("models"."schema", '$.pages') AS page
    WHERE json_type(page.value, '$.permission') IS NULL
  );
