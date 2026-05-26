-- ============================================================
-- DugoutOS — Supabase Database Schema
-- Paste this into Supabase SQL Editor and run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  age_group     TEXT NOT NULL DEFAULT '10U',
  season_label  TEXT,
  head_coach    TEXT,
  city          TEXT,
  state         TEXT DEFAULT 'TX',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE players (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  jersey_number TEXT,
  position      TEXT,
  bats          TEXT DEFAULT 'R',
  throws        TEXT DEFAULT 'R',
  grad_year     INT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE games (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  game_date     DATE NOT NULL,
  opponent      TEXT NOT NULL,
  location_type TEXT DEFAULT 'Home',
  game_type     TEXT DEFAULT 'Regular',
  result        TEXT CHECK (result IN ('W','L','T')),
  our_score     INT DEFAULT 0,
  their_score   INT DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_stats (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id       UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id     UUID REFERENCES players(id) ON DELETE CASCADE,
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ab            INT DEFAULT 0,
  h             INT DEFAULT 0,
  doubles       INT DEFAULT 0,
  triples       INT DEFAULT 0,
  hr            INT DEFAULT 0,
  rbi           INT DEFAULT 0,
  runs          INT DEFAULT 0,
  bb            INT DEFAULT 0,
  k             INT DEFAULT 0,
  sb            INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

CREATE TABLE practice_plans (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  age            TEXT,
  duration       TEXT,
  focus          TEXT,
  coaches_list   TEXT,
  coach_content  TEXT,
  player_content TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tournaments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  location        TEXT,
  start_date      DATE,
  end_date        DATE,
  format          TEXT,
  uniform_primary TEXT,
  uniform_alt     TEXT,
  parking_info    TEXT,
  food_plan       TEXT,
  notes           TEXT,
  coach_content   TEXT,
  parent_content  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tournament_games (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  day_number    INT DEFAULT 1,
  game_number   INT DEFAULT 1,
  game_time     TIME,
  arrive_by     TIME,
  opponent      TEXT,
  field         TEXT,
  uniform       TEXT DEFAULT 'Primary',
  notes         TEXT
);

CREATE TABLE fundraising_campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT,
  goal_amount     DECIMAL(10,2) DEFAULT 0,
  raised_amount   DECIMAL(10,2) DEFAULT 0,
  per_player_goal DECIMAL(10,2),
  start_date      DATE,
  end_date        DATE,
  coordinator     TEXT,
  location        TEXT,
  description     TEXT,
  status          TEXT DEFAULT 'active',
  coord_content   TEXT,
  family_content  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drill_library (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  topic       TEXT NOT NULL,
  age         TEXT,
  level       TEXT,
  category    TEXT,
  content     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE band_posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  post_type   TEXT,
  platform    TEXT DEFAULT 'band',
  content     TEXT,
  posted      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX ON players(org_id);
CREATE INDEX ON games(org_id);
CREATE INDEX ON games(game_date);
CREATE INDEX ON player_stats(game_id);
CREATE INDEX ON player_stats(player_id);
CREATE INDEX ON player_stats(org_id);
CREATE INDEX ON practice_plans(org_id);
CREATE INDEX ON tournaments(org_id);
CREATE INDEX ON tournament_games(tournament_id);
CREATE INDEX ON fundraising_campaigns(org_id);
CREATE INDEX ON drill_library(org_id);
CREATE INDEX ON band_posts(org_id);

-- RLS (enable — add policies after configuring Auth)
ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE players                ENABLE ROW LEVEL SECURITY;
ALTER TABLE games                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats           ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_games       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundraising_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_library          ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_posts             ENABLE ROW LEVEL SECURITY;
