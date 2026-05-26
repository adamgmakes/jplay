alter table game_sessions drop constraint if exists game_sessions_mode_check;
alter table game_sessions
  add constraint game_sessions_mode_check
  check (mode in ('board', 'random', 'voice', 'playalong'));
