-- Supabase-specific: links profiles to Supabase Auth and keeps them in sync.
-- This migration targets a real Supabase project (it references the `auth`
-- schema Supabase manages) and cannot be applied to a plain local Postgres
-- instance without that schema present.

-- Link profiles.id to Supabase's auth.users(id)
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create a profile row automatically whenever a new Supabase Auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, "createdAt", "updatedAt")
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    'user',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Row level security: our backend connects with the Postgres role directly
-- (bypassing RLS), but profiles should still be locked down in case it's
-- ever queried through Supabase's Data API.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON "profiles" FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON "profiles" FOR UPDATE
  USING (auth.uid() = id);
