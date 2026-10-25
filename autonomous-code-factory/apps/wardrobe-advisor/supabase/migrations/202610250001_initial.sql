-- Persistence is deliberately opt-in: the current MVP does not store photos
-- or analysis results. Add user-owned tables here when saved wardrobes become
-- an accepted product requirement, then enable narrowly scoped RLS policies.

create extension if not exists pgcrypto;
