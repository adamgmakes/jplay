-- J! Play schema
create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  game_id integer not null,
  air_date date,
  show_number integer,
  score integer default 0,
  coryat_score integer default 0,
  clues_seen integer default 0,
  clues_correct integer default 0,
  clues_incorrect integer default 0,
  clues_accepted_override integer default 0,
  daily_doubles_seen integer default 0,
  daily_doubles_correct integer default 0,
  final_jeopardy_wager integer,
  final_jeopardy_correct boolean,
  contestant_rank integer,
  completed boolean default false,
  mode text check (mode in ('board','random','voice')) default 'board',
  played_at timestamptz default now()
);

create table if not exists category_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  category_name text not null,
  correct integer default 0,
  incorrect integer default 0,
  updated_at timestamptz default now(),
  unique(user_id, category_name)
);

alter table profiles enable row level security;
alter table game_sessions enable row level security;
alter table category_stats enable row level security;

drop policy if exists "Profiles publicly readable" on profiles;
create policy "Profiles publicly readable" on profiles for select using (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

drop policy if exists "Sessions publicly readable" on game_sessions;
create policy "Sessions publicly readable" on game_sessions for select using (true);

drop policy if exists "Users insert own sessions" on game_sessions;
create policy "Users insert own sessions" on game_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own sessions" on game_sessions;
create policy "Users update own sessions" on game_sessions for update using (auth.uid() = user_id);

drop policy if exists "Users delete own sessions" on game_sessions;
create policy "Users delete own sessions" on game_sessions for delete using (auth.uid() = user_id);

drop policy if exists "Users manage own category stats" on category_stats;
create policy "Users manage own category stats" on category_stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Leaderboard views / RPCs
create or replace view v_user_aggregate as
select
  p.id as user_id,
  p.username,
  count(s.id)::int as games_played,
  coalesce(avg(s.coryat_score), 0)::int as avg_coryat,
  coalesce(max(s.coryat_score), 0)::int as best_coryat,
  coalesce(sum(s.clues_correct), 0)::int as total_correct,
  coalesce(sum(s.clues_incorrect), 0)::int as total_incorrect,
  coalesce(sum(case when s.contestant_rank = 1 then 1 else 0 end), 0)::int as wins
from profiles p
left join game_sessions s on s.user_id = p.id and s.completed = true
group by p.id, p.username;

create or replace view v_leaderboard_top_coryat as
select s.id as session_id, s.user_id, p.username, s.coryat_score, s.score,
       s.air_date, s.played_at, s.game_id
from game_sessions s
join profiles p on p.id = s.user_id
where s.completed = true
order by s.coryat_score desc
limit 20;

create or replace view v_leaderboard_avg_coryat as
select user_id, username, games_played, avg_coryat
from v_user_aggregate
where games_played >= 5
order by avg_coryat desc
limit 20;

create or replace view v_leaderboard_most_played as
select user_id, username, games_played, avg_coryat
from v_user_aggregate
order by games_played desc
limit 20;

create or replace view v_leaderboard_week as
select s.id as session_id, s.user_id, p.username, s.coryat_score, s.played_at
from game_sessions s
join profiles p on p.id = s.user_id
where s.completed = true and s.played_at >= (now() - interval '7 days')
order by s.coryat_score desc
limit 20;
