-- SNU Lab Navigator user data schema.
-- Apply in a Supabase project before enabling account sync.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_.-]{3,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  lab_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, lab_id)
);

create table if not exists public.gemini_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cipher_text text not null,
  nonce text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.compare_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, cache_key)
);

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.gemini_keys enable row level security;
alter table public.compare_cache enable row level security;

create policy "profiles own row" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "favorites own rows" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "compare cache own rows" on public.compare_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- gemini_keys has intentionally NO direct client policy. Reads/writes happen
-- only through the Edge Function, using the user's authenticated JWT and the
-- project's service-role secret server side.

drop trigger if exists on_auth_user_created on auth.users;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set username = excluded.username, updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
