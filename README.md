# Custom Email Alias Application (olo.pro.bd)

This is a full-stack web application allowing users to claim custom email aliases on your domain and forward them to their personal Gmail addresses. 

It is built with:
- **Frontend**: React (Vite)
- **Database / Auth**: Supabase (Postgres with RLS)
- **Backend APIs**: Supabase Edge Functions (Deno/TypeScript)
- **Email Forwarding**: ImprovMX

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase details:
```bash
cp .env.example .env
```
*(You will need `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project dashboard).*

### 3. Supabase Local Setup (Edge Functions & Database)
Ensure you have the Supabase CLI installed, or use npx.

```bash
# Start local Supabase instance
npx supabase start

# Apply database migrations (creates email_aliases table & RLS policies)
npx supabase db push

# Create a local .env file inside supabase folder for edge functions
echo "SUPABASE_URL=your_project_url" > supabase/.env
echo "SUPABASE_ANON_KEY=your_anon_key" >> supabase/.env
echo "SUPABASE_SERVICE_ROLE_KEY=your_service_key" >> supabase/.env
echo "IMPROVMX_API_KEY=your_improvmx_api_key" >> supabase/.env
echo "EMAIL_DOMAIN=olo.pro.bd" >> supabase/.env

# Start edge functions locally
npx supabase functions serve --env-file supabase/.env
```

### 4. Run Frontend
```bash
npm run dev
```

## ImprovMX Setup
1. Go to [ImprovMX](https://improvmx.com/) and add your domain `olo.pro.bd`.
2. Configure the DNS MX records as instructed by ImprovMX on your domain registrar.
3. Once verified, get your ImprovMX API Key (from the Dashboard/Settings).
4. Add this API key to your Supabase Edge Function environment variables.

## Deployment

### Deploying Frontend (Vercel)
1. Push your repository to GitHub.
2. Import the project into Vercel.
3. Add the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables.
4. Deploy!

### Deploying Backend (Supabase)
1. Link your Supabase project: `npx supabase link --project-ref your-project-ref`
2. Push database migrations: `npx supabase db push`
3. Set secrets for edge functions:
   ```bash
   npx supabase secrets set IMPROVMX_API_KEY=your_key
   npx supabase secrets set EMAIL_DOMAIN=olo.pro.bd
   # Note: SUPABASE_URL, ANON_KEY, and SERVICE_ROLE_KEY are built-in automatically.
   ```
4. Deploy Edge Functions:
   ```bash
   npx supabase functions deploy create-alias
   npx supabase functions deploy delete-alias
   ```
