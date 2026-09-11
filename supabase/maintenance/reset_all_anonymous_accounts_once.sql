-- ONE-TIME MANUAL CLEANUP
-- Run this only in the Supabase SQL Editor when you intentionally want to
-- remove every anonymous account created by SNU Lab Navigator and release all
-- usernames. It does NOT touch non-anonymous users.
--
-- Supabase Anonymous Sign-Ins are stored in auth.users with is_anonymous=true.
-- Deleting the auth user cascades to public.profiles/favorites/compare_cache
-- because those tables reference auth.users with ON DELETE CASCADE.
--
-- This is intentionally NOT a schema migration and is NOT executed by CI.

delete from auth.users
where is_anonymous is true;

-- Optional verification after the delete:
-- select count(*) as remaining_anonymous_users
-- from auth.users
-- where is_anonymous is true;
