-- Persist form groups as real Card nodes before removing page-level groups.
UPDATE "models" AS model
SET "schema" = json_set(
  model."schema",
  '$.form',
  json_object(
    'type',
    'object',
    'properties',
    json(
      (
        SELECT json_group_object(entry.key, json(entry.value))
        FROM (
          SELECT
            CASE group_node.key
              WHEN 0 THEN 'base'
              ELSE 'group_' || group_node.key
            END AS key,
            json_patch(
              json_remove(group_node.value, '$.keys'),
              json_object(
                'type',
                'void',
                'properties',
                json(
                  (
                    SELECT json_group_object(
                      field_key.value,
                      json_object('$ref', '#/fields/' || field_key.value)
                    )
                    FROM json_each(group_node.value, '$.keys') AS field_key
                  )
                )
              )
            ) AS value
          FROM json_each(
            COALESCE(
              (
                SELECT json_extract(page.value, '$.groups')
                FROM json_each(model."schema", '$.pages') AS page
                WHERE json_type(page.value, '$.groups') = 'array'
                ORDER BY json_extract(page.value, '$.router') = 'add' DESC, page.key
                LIMIT 1
              ),
              '[]'
            )
          ) AS group_node

          UNION ALL

          SELECT
            field.value ->> '$.key' AS key,
            json_object('$ref', '#/fields/' || (field.value ->> '$.key')) AS value
          FROM json_each(model."schema", '$.fields') AS field
          WHERE COALESCE(json_extract(field.value, '$.database.system'), 0) = 0
            AND NOT EXISTS (
              SELECT 1
              FROM json_each(
                COALESCE(
                  (
                    SELECT json_extract(page.value, '$.groups')
                    FROM json_each(model."schema", '$.pages') AS page
                    WHERE json_type(page.value, '$.groups') = 'array'
                    ORDER BY json_extract(page.value, '$.router') = 'add' DESC, page.key
                    LIMIT 1
                  ),
                  '[]'
                )
              ) AS group_node,
              json_each(group_node.value, '$.keys') AS field_key
              WHERE field_key.value = field.value ->> '$.key'
            )

          UNION ALL

          SELECT
            'system' AS key,
            json_object(
              'type',
              'void',
              'component',
              'Card',
              'title',
              '系统信息',
              'display',
              '{{ mode === ''detail'' ? ''visible'' : ''none'' }}',
              'props',
              json_object('gridSpan', 12),
              'properties',
              json(
                (
                  SELECT json_group_object(
                    system_field.value ->> '$.key',
                    json_object('$ref', '#/fields/' || (system_field.value ->> '$.key'))
                  )
                  FROM json_each(model."schema", '$.fields') AS system_field
                  WHERE json_extract(system_field.value, '$.database.system') = 1
                )
              )
            ) AS value
          WHERE EXISTS (
            SELECT 1
            FROM json_each(model."schema", '$.fields') AS system_field
            WHERE json_extract(system_field.value, '$.database.system') = 1
          )
        ) AS entry
      )
    )
  )
)
WHERE json_type(model."schema", '$.form') IS NULL;

-- Move field semantics to the field root and keep storage as the only
-- persistence declaration. Relation-backed component props are compiler-owned.
UPDATE "models" AS model
SET "schema" = json_set(
  model."schema",
  '$.fields',
  json(
    (
      SELECT json_group_array(
        json(
          json_patch(
            json_remove(
              field.value,
              '$.database',
              '$.form.type',
              '$.form.title',
              '$.form.required',
              '$.form.props.model',
              '$.form.props.valueField',
              '$.form.props.labelField',
              '$.form.props.loadOptions',
              '$.form.props.loadData',
              '$.form.props.multiple',
              '$.form.props.parentField',
              '$.form.props.pageSize'
            ),
            json_object(
              'type',
              json_extract(field.value, '$.form.type'),
              'title',
              json_extract(field.value, '$.form.title'),
              'required',
              CASE
                WHEN json_extract(field.value, '$.form.required') = 1
                  OR json_extract(field.value, '$.database.nullable') = 0
                  THEN json('true')
                ELSE NULL
              END,
              'storage',
              CASE
                WHEN json_type(field.value, '$.database') = 'object'
                  THEN json(
                    json_remove(
                      json_extract(field.value, '$.database'),
                      '$.nullable',
                      '$.valueType'
                    )
                  )
                ELSE NULL
              END,
              'form',
              json(
                json_remove(
                  json_extract(field.value, '$.form'),
                  '$.type',
                  '$.title',
                  '$.required',
                  '$.props.model',
                  '$.props.valueField',
                  '$.props.labelField',
                  '$.props.loadOptions',
                  '$.props.loadData',
                  '$.props.multiple',
                  '$.props.parentField',
                  '$.props.pageSize'
                )
              )
            )
          )
        )
      )
      FROM json_each(model."schema", '$.fields') AS field
    )
  )
)
WHERE EXISTS (
  SELECT 1
  FROM json_each(model."schema", '$.fields') AS field
  WHERE json_type(field.value, '$.database') IS NOT NULL
     OR json_type(field.value, '$.form.type') IS NOT NULL
);

-- Work on individual pages so nested slot owners can be rewritten from the
-- deepest node outward without assuming a fixed component hierarchy.
CREATE TABLE "_protocol_pages" (
  "model_name" TEXT NOT NULL,
  "page_index" INTEGER NOT NULL,
  "page" TEXT NOT NULL,
  PRIMARY KEY ("model_name", "page_index")
);

INSERT INTO "_protocol_pages" ("model_name", "page_index", "page")
SELECT
  model."name",
  page.key,
  CASE
    WHEN json_type(page.value, '$.layout') = 'object' THEN
      json_set(
        json_patch(
          json_remove(page.value, '$.layout', '$.groups'),
          json_extract(page.value, '$.layout')
        ),
        '$.type',
        'void'
      )
    WHEN json_type(page.value, '$.properties.form') = 'object'
      AND (SELECT COUNT(*) FROM json_each(page.value, '$.properties')) = 1 THEN
      json_patch(
        json_remove(page.value, '$.groups', '$.properties'),
        json_extract(page.value, '$.properties.form')
      )
    ELSE
      json_set(json_remove(page.value, '$.groups'), '$.type', 'void')
  END
FROM "models" AS model, json_each(model."schema", '$.pages') AS page
WHERE json_type(page.value, '$.layout') IS NOT NULL
   OR json_type(page.value, '$.groups') IS NOT NULL
   OR json_type(page.value, '$.properties') IS NOT NULL;

CREATE TABLE "_protocol_slot_nodes" AS
SELECT
  pages."model_name",
  pages."page_index",
  tree.fullkey AS node_path,
  ROW_NUMBER() OVER (
    PARTITION BY pages."model_name", pages."page_index"
    ORDER BY LENGTH(tree.fullkey) DESC, tree.fullkey DESC
  ) AS step
FROM "_protocol_pages" AS pages, json_tree(pages."page") AS tree
WHERE tree.type = 'object'
  AND json_type(tree.value, '$.slots') = 'object'
  AND json_type(tree.value, '$.properties') = 'object';

CREATE TABLE "_protocol_pages_migrated" (
  "model_name" TEXT NOT NULL,
  "page_index" INTEGER NOT NULL,
  "page" TEXT NOT NULL,
  PRIMARY KEY ("model_name", "page_index")
);

INSERT INTO "_protocol_pages_migrated" ("model_name", "page_index", "page")
WITH RECURSIVE transformed("model_name", "page_index", "step", "page") AS (
  SELECT pages."model_name", pages."page_index", 0, pages."page"
  FROM "_protocol_pages" AS pages

  UNION ALL

  SELECT
    transformed."model_name",
    transformed."page_index",
    transformed."step" + 1,
    json_set(
      transformed."page",
      slot_node.node_path,
      json(
        json_patch(
          json_remove(
            json_extract(transformed."page", slot_node.node_path),
            '$.properties',
            '$.slots'
          ),
          json_object(
            'properties',
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM json_each(
                  json_extract(transformed."page", slot_node.node_path),
                  '$.properties'
                ) AS property
                WHERE NOT EXISTS (
                  SELECT 1
                  FROM json_each(
                    json_extract(transformed."page", slot_node.node_path),
                    '$.slots'
                  ) AS slot
                  WHERE (slot.type = 'text' AND slot.value = property.key)
                     OR (
                       slot.type = 'array'
                       AND EXISTS (
                         SELECT 1
                         FROM json_each(slot.value) AS reference
                         WHERE reference.value = property.key
                       )
                     )
                )
              ) THEN json(
                (
                  SELECT json_group_object(property.key, json(property.value))
                  FROM json_each(
                    json_extract(transformed."page", slot_node.node_path),
                    '$.properties'
                  ) AS property
                  WHERE NOT EXISTS (
                    SELECT 1
                    FROM json_each(
                      json_extract(transformed."page", slot_node.node_path),
                      '$.slots'
                    ) AS slot
                    WHERE (slot.type = 'text' AND slot.value = property.key)
                       OR (
                         slot.type = 'array'
                         AND EXISTS (
                           SELECT 1
                           FROM json_each(slot.value) AS reference
                           WHERE reference.value = property.key
                         )
                       )
                  )
                )
              )
              ELSE NULL
            END,
            'slots',
            json(
              (
                SELECT json_group_object(
                  slot.key,
                  json(
                    CASE slot.type
                      WHEN 'text' THEN json_object(
                        slot.value,
                        json_extract(
                          transformed."page",
                          slot_node.node_path || '.properties.' || json_quote(slot.value)
                        )
                      )
                      WHEN 'array' THEN (
                        SELECT json_group_object(
                          reference.value,
                          json(
                            json_extract(
                              transformed."page",
                              slot_node.node_path || '.properties.' || json_quote(reference.value)
                            )
                          )
                        )
                        FROM json_each(slot.value) AS reference
                      )
                      ELSE slot.value
                    END
                  )
                )
                FROM json_each(
                  json_extract(transformed."page", slot_node.node_path),
                  '$.slots'
                ) AS slot
              )
            )
          )
        )
      )
    )
  FROM transformed
  JOIN "_protocol_slot_nodes" AS slot_node
    ON slot_node."model_name" = transformed."model_name"
   AND slot_node."page_index" = transformed."page_index"
   AND slot_node."step" = transformed."step" + 1
)
SELECT transformed."model_name", transformed."page_index", transformed."page"
FROM transformed
WHERE transformed."step" = (
  SELECT COUNT(*)
  FROM "_protocol_slot_nodes" AS slot_node
  WHERE slot_node."model_name" = transformed."model_name"
    AND slot_node."page_index" = transformed."page_index"
);

UPDATE "models" AS model
SET "schema" = json_set(
  model."schema",
  '$.pages',
  json(
    (
      SELECT json_group_array(
        json(COALESCE(migrated.page, page.value))
      )
      FROM json_each(model."schema", '$.pages') AS page
      LEFT JOIN "_protocol_pages_migrated" AS migrated
        ON migrated."model_name" = model."name"
       AND migrated."page_index" = page.key
    )
  )
)
WHERE EXISTS (
  SELECT 1
  FROM "_protocol_pages_migrated" AS migrated
  WHERE migrated."model_name" = model."name"
);

DROP TABLE "_protocol_pages_migrated";
DROP TABLE "_protocol_slot_nodes";
DROP TABLE "_protocol_pages";
