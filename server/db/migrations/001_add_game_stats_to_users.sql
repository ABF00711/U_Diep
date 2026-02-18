-- Run this ONCE if you already have users table without level/xp/stat_points.
-- Adds level, xp, xp_to_next_level, stat_points for persistence across sessions and death penalty.
-- Skip if you get "Duplicate column" (columns already exist).

ALTER TABLE users ADD COLUMN level INT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN xp INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN xp_to_next_level INT NOT NULL DEFAULT 100;
ALTER TABLE users ADD COLUMN stat_points JSON;
