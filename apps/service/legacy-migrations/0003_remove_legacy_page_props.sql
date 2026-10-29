UPDATE "models"
SET "schema" = json_set(
  "schema",
  '$.pages',
  json(
    (
      SELECT json_group_array(
        json(
          json_remove(
            page.value,
            '$.layout.props.left',
            '$.layout.props.rightTop',
            '$.layout.props.rightBottom',
            '$.properties.table.props.actionBtns',
            '$.properties.table.props.rowActions'
          )
        )
      )
      FROM json_each("models"."schema", '$.pages') AS page
    )
  )
)
WHERE json_type("schema", '$.pages') = 'array';
