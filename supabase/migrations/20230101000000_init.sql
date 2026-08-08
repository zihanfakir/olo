CREATE TABLE public.email_aliases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  alias text UNIQUE NOT NULL,
  forward_to text NOT NULL,
  improvmx_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.email_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own aliases"
  ON public.email_aliases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own aliases"
  ON public.email_aliases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own aliases"
  ON public.email_aliases
  FOR DELETE
  USING (auth.uid() = user_id);
