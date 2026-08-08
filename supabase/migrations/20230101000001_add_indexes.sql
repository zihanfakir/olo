-- Add index on user_id to optimize dashboard loading times
CREATE INDEX IF NOT EXISTS idx_email_aliases_user_id ON public.email_aliases (user_id);
