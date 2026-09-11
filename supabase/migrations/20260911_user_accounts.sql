-- SNU Lab Navigator account layer.
-- ID-only, non-PII identity using Supabase Anonymous Auth.
-- The public username is a unique display/account label; the anonymous
-- auth session is the actual credential. No password/email/phone is required.

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

-- Remove older email-backed/user-key drafts if they were previously applied.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop table if exists public.gemini_keys cascade;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(new.raw_user_meta_data ->> 'username'), '') <> '' then
    insert into public.profiles (id, username)
    values (new.id, lower(trim(new.raw_user_meta_data ->> 'username')))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

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

create or replace function public.username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text := lower(trim(p_username));
begin
  if uname !~ '^[a-z0-9_.-]{3,40}$' then raise exception 'invalid_username'; end if;
  return not exists(select 1 from public.profiles where lower(username) = uname);
end;
$$;

grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.claim_username(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text := lower(trim(p_username));
  already boolean;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if uname !~ '^[a-z0-9_.-]{3,40}$' then raise exception 'invalid_username'; end if;

  select exists(select 1 from public.profiles where id = uid and lower(username) = uname) into already;
  if already then return true; end if;

  begin
    insert into public.profiles (id, username) values (uid, uname);
    return true;
  exception when unique_violation then
    return exists(select 1 from public.profiles where id = uid and lower(username) = uname);
  end;
end;
$$;

grant execute on function public.claim_username(text) to authenticated;

-- No personal Gemini API key is stored. AI uses the operator-managed
-- GEMINI_API_KEY secret in the Edge Function.
