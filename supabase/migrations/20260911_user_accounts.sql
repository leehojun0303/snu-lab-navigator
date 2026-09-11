-- SNU Lab Navigator account layer.
-- ID-only, non-PII identity using Supabase Anonymous Auth.
-- The public username is only a unique display/account label; the anonymous
-- auth session is the actual credential. No password/email/phone is stored.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_.-]{3,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_ci on public.profiles (lower(username));

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  lab_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, lab_id)
);

create table if not exists public.compare_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, cache_key)
);

-- Remove the older per-user Gemini-key table if an earlier draft migration
-- was already applied. Current architecture uses only the operator-managed
-- GEMINI_API_KEY secret in the Edge Function.
drop table if exists public.gemini_keys cascade;

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.compare_cache enable row level security;

drop policy if exists "profiles own row" on public.profiles;
create policy "profiles own row" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "favorites own rows" on public.favorites;
create policy "favorites own rows" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "compare cache own rows" on public.compare_cache;
create policy "compare cache own rows" on public.compare_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.claim_username(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text := lower(trim(p_username));
  inserted boolean := false;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if uname !~ '^[a-z0-9_.-]{3,40}$' then raise exception 'invalid_username'; end if;
  begin
    insert into public.profiles (id, username) values (uid, uname);
    inserted := true;
  exception when unique_violation then
    inserted := exists(select 1 from public.profiles where id = uid and username = uname);
  end;
  return inserted;
end;
$$;

grant execute on function public.claim_username(text) to authenticated;

-- No password, email, phone number, or personal Gemini API key is required.
