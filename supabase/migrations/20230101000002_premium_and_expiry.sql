-- Create profiles table
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  email text NOT NULL,
  is_admin boolean DEFAULT false NOT NULL,
  premium_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Only admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true)
  );

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Only admins can update profiles
CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true)
  );

-- Trigger to create a profile automatically when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin)
  VALUES (
    new.id, 
    new.email, 
    -- Make zihanfakir@gmail.com admin automatically
    new.email = 'zihanfakir@gmail.com'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create profiles for existing users
INSERT INTO public.profiles (id, email, is_admin)
SELECT id, email, (email = 'zihanfakir@gmail.com')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Update email_aliases table
ALTER TABLE public.email_aliases 
ADD COLUMN expires_at timestamp with time zone DEFAULT (now() + interval '24 hours') NOT NULL,
ADD COLUMN last_extended_at timestamp with time zone;

