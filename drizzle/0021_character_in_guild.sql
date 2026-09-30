-- When Battle.net last showed the character in the guild's in-game guild (same name, faction and, for versions with realms, realm); null when it wasn't, or hasn't been checked.
ALTER TABLE "characters" ADD COLUMN "in_guild_confirmed_at" timestamp with time zone;
