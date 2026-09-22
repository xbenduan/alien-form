UPDATE "models"
SET "schema" = json_set(
  "schema",
  '$.pages',
  json(
    (
      SELECT json_group_array(
        json(
          CASE
            WHEN json_type(page.value, '$.properties.table') IS NULL THEN page.value
            ELSE json_set(
              json_set(
                page.value,
                '$.properties.table.slots',
                json(COALESCE(json_extract(page.value, '$.properties.table.slots'), '{}'))
              ),
              '$.properties.table.slots.rowActions',
              json(
                COALESCE(
                  (
                    SELECT json_group_array(child.key)
                    FROM json_each(page.value, '$.properties.table.properties') AS child
                    WHERE json_extract(child.value, '$.component') = 'row-button'
                  ),
                  '[]'
                )
              )
            )
          END
        )
      )
      FROM json_each("models"."schema", '$.pages') AS page
    )
  )
)
WHERE json_type("schema", '$.pages') = 'array';
