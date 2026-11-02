-- One-time persisted format upgrade, applied atomically by D1 migrations.
-- Keep the exact historical JSON alongside its upgraded representation.
CREATE TABLE fw_page_local_views_backup (
  source TEXT NOT NULL CHECK(source IN ('version', 'draft')),
  model_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  definition_json TEXT NOT NULL,
  migrated_definition_json TEXT NOT NULL,
  migrated_at TEXT NOT NULL,
  PRIMARY KEY(source, model_id, version)
);

INSERT INTO fw_page_local_views_backup
  (source, model_id, version, definition_json, migrated_definition_json, migrated_at)
SELECT source, model_id, version, definition_json, definition_json, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
  SELECT 'version' AS source, model_id, version, definition_json FROM fw_model_versions
  UNION ALL
  SELECT 'draft', model_id, 0, definition_json FROM fw_model_drafts
)
WHERE json_type(definition_json, '$.document.views') = 'object'
  AND (
    json_type(definition_json, '$.document.views.add') = 'object'
    OR json_type(definition_json, '$.document.views.edit') = 'object'
    OR json_type(definition_json, '$.document.views.detail') = 'object'
  );

-- Copy only missing local keys; explicit nulls and other invalid overrides
-- remain visible to configuration validation instead of being silently fixed.
WITH RECURSIVE
steps(step, legacy, target) AS (
  VALUES
    (1, 'add', 'list/add'), (2, 'add', 'tree-list/add'), (3, 'add', NULL),
    (4, 'edit', 'list/edit'), (5, 'edit', 'tree-list/edit'), (6, 'edit', NULL),
    (7, 'detail', 'list/detail'), (8, 'detail', 'tree-list/detail'), (9, 'detail', NULL)
),
converted(source, model_id, version, step, definition_json) AS (
  SELECT source, model_id, version, 0, definition_json FROM fw_page_local_views_backup
  UNION ALL
  SELECT c.source, c.model_id, c.version, s.step,
    CASE
      WHEN json_type(c.definition_json, '$.document.views.' || s.legacy) != 'object'
        OR json_type(c.definition_json, '$.document.views.' || s.legacy) IS NULL
        THEN c.definition_json
      WHEN s.target IS NULL
        THEN json_remove(c.definition_json, '$.document.views.' || s.legacy)
      WHEN json_type(c.definition_json, '$.document.views."' || s.target || '"') IS NULL
        THEN json_set(
          c.definition_json,
          '$.document.views."' || s.target || '"',
          json_extract(c.definition_json, '$.document.views.' || s.legacy)
        )
      ELSE c.definition_json
    END
  FROM converted c JOIN steps s ON s.step = c.step + 1
)
UPDATE fw_page_local_views_backup AS b
SET migrated_definition_json = (
  SELECT c.definition_json FROM converted c
  WHERE c.source = b.source AND c.model_id = b.model_id AND c.version = b.version AND c.step = 9
);

-- Suspend UPDATE protection only inside this format-upgrade transaction.
-- Version numbers, revisions, storage manifests and publication metadata stay unchanged.
DROP TRIGGER fw_versions_immutable_update;
UPDATE fw_model_versions AS v
SET definition_json = (
  SELECT b.migrated_definition_json FROM fw_page_local_views_backup b
  WHERE b.source = 'version' AND b.model_id = v.model_id AND b.version = v.version
)
WHERE EXISTS (
  SELECT 1 FROM fw_page_local_views_backup b
  WHERE b.source = 'version' AND b.model_id = v.model_id AND b.version = v.version
);
CREATE TRIGGER fw_versions_immutable_update BEFORE UPDATE ON fw_model_versions
BEGIN SELECT RAISE(ABORT, 'published versions are immutable'); END;

UPDATE fw_model_drafts AS d
SET definition_json = (
  SELECT b.migrated_definition_json FROM fw_page_local_views_backup b
  WHERE b.source = 'draft' AND b.model_id = d.model_id
)
WHERE EXISTS (
  SELECT 1 FROM fw_page_local_views_backup b
  WHERE b.source = 'draft' AND b.model_id = d.model_id
);
