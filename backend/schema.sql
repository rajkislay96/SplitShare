-- SplitShare database schema

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_color  TEXT NOT NULL DEFAULT '#2B6E5E',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups_table (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '💰',
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id  INTEGER NOT NULL REFERENCES groups_table(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id           SERIAL PRIMARY KEY,
  group_id     INTEGER NOT NULL REFERENCES groups_table(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  paid_by      INTEGER NOT NULL REFERENCES users(id),
  split_type   TEXT NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage')),
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id             SERIAL PRIMARY KEY,
  expense_id     INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  owed_cents     BIGINT NOT NULL CHECK (owed_cents >= 0),
  UNIQUE (expense_id, user_id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id           SERIAL PRIMARY KEY,
  group_id     INTEGER NOT NULL REFERENCES groups_table(id) ON DELETE CASCADE,
  from_user    INTEGER NOT NULL REFERENCES users(id),
  to_user      INTEGER NOT NULL REFERENCES users(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  note         TEXT
);

CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_splits_user ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
