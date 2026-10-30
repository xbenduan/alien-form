-- Account preferences do not modify model revisions or business records.
CREATE TABLE fw_model_menu_pins (
  user_id TEXT NOT NULL,
  model_id TEXT NOT NULL REFERENCES fw_models(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, model_id)
);
