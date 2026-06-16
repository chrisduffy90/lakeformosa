-- Run this in the Neon SQL editor to create the tables

CREATE TABLE IF NOT EXISTS signups (
  id         SERIAL PRIMARY KEY,
  first_name TEXT        NOT NULL,
  last_name  TEXT        NOT NULL DEFAULT '',
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS get_involved (
  id         SERIAL PRIMARY KEY,
  first_name TEXT        NOT NULL,
  last_name  TEXT        NOT NULL DEFAULT '',
  email      TEXT        NOT NULL,
  address    TEXT        NOT NULL DEFAULT '',
  interests  TEXT[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         SERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  subject    TEXT        NOT NULL DEFAULT 'General',
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  "order"     INTEGER     NOT NULL DEFAULT 99,
  bio         TEXT        NOT NULL DEFAULT '',
  email       TEXT        NOT NULL DEFAULT '',
  headshot_url TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  date        DATE        NOT NULL,
  time        TEXT        NOT NULL,
  location    TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
