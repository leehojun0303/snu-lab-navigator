-- ID-ONLY ACCOUNT MODEL
-- The user explicitly chose a simple, non-PII account identifier: an account is
-- recovered by entering a previously registered unique ID. This is NOT strong
-- authentication; anyone who knows an ID can act as that account. Do not use
-- this model for sensitive/private data.

-- Remove the earlier Anonymous-Auth account tables/policies/functions. The app
-- no longer relies on auth.users for application accounts.
drop function if exists public.claim_username(text) cascade;
drop function if exists public.username_available(text) cascade;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop table if exists public.favorites cascade;
drop table if exists public.compare_cache cascade;
drop table if exists public.profiles cascade;
drop table if exists public.gemini_keys cascade;

create table public.lab_accounts (
  username text primary key,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create unique index lab_accounts_username_ci on public.lab_accounts(lower(username));

create table public.lab_favorites (
  username text not null references public.lab_accounts(username) on delete cascade,
  lab_id text not null,
  created_at timestamptz not null default now(),
  primary key (username, lab_id)
);

-- Only the stored procedures are callable by the public anon client. The base
-- tables themselves are not granted to anon/authenticated.
revoke all on table public.lab_accounts from anon, authenticated;
revoke all on table public.lab_favorites from anon, authenticated;

create or replace function public.create_lab_account(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text := lower(trim(p_username));
begin
  if uname !~ '^[a-z0-9_.-]{3,40}$' then
    raise exception 'invalid_username';
  end if;
  begin
    insert into public.lab_accounts(username) values (uname);
    return true;
  exception when unique_violation then
    return false;
  end;
end;
$$;

grant execute on function public.create_lab_account(text) to anon, authenticated;

create or replace function public.login_lab_account(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text := lower(trim(p_username));
  exists_account boolean;
begin
  if uname !~ '^[a-z0-9_.-]{3,40}$' then
    raise exception 'invalid_username';
  end if;
  select exists(select 1 from public.lab_accounts where username = uname) into exists_account;
  if exists_account then
    update public.lab_accounts set last_login_at = now() where username = uname;
  end if;
  return exists_account;
end;
$$;

grant execute on function public.login_lab_account(text) to anon, authenticated;

create or replace function public.get_lab_favorites(p_username text)
returns table(lab_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text := lower(trim(p_username));
begin
  if not exists(select 1 from public.lab_accounts where username = uname) then
    return;
  end if;
  return query
    select f.lab_id
    from public.lab_favorites f
    where f.username = uname
    order by f.created_at asc;
end;
$$;

grant execute on function public.get_lab_favorites(text) to anon, authenticated;

create or replace function public.set_lab_favorite(p_username text, p_lab_id text, p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text := lower(trim(p_username));
  lid text := trim(p_lab_id);
begin
  if not exists(select 1 from public.lab_accounts where username = uname) then
    return false;
  end if;
  if lid = '' then
    raise exception 'invalid_lab_id';
  end if;
  if p_enabled then
    insert into public.lab_favorites(username, lab_id)
    values (uname, lid)
    on conflict (username, lab_id) do nothing;
  else
    delete from public.lab_favorites where username = uname and lab_id = lid;
  end if;
  return true;
end;
$$;

grant execute on function public.set_lab_favorite(text, text, boolean) to anon, authenticated;

-- No password, email, phone number, personal Gemini API key, or other PII is
-- collected by the app account system.
