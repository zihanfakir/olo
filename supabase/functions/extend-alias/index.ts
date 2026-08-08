import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { alias } = await req.json()
    if (!alias) {
      return new Response(JSON.stringify({ error: 'Alias is required' }), { status: 400, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch the alias to check its last_extended_at
    const { data: aliasData, error: aliasError } = await supabaseAdmin
      .from('email_aliases')
      .select('*')
      .eq('alias', alias)
      .eq('user_id', user.id)
      .single()

    if (aliasError || !aliasData) {
      return new Response(JSON.stringify({ error: 'Alias not found' }), { status: 404, headers: corsHeaders })
    }

    // Check 10 AM limit logic (Bangladesh time = UTC + 6)
    // 10 AM BD = 4 AM UTC
    const now = new Date()
    let mostRecent10AM_UTC = new Date()
    mostRecent10AM_UTC.setUTCHours(4, 0, 0, 0)

    if (now.getTime() < mostRecent10AM_UTC.getTime()) {
      // It's before 10 AM BD time today, so the most recent 10 AM was yesterday
      mostRecent10AM_UTC.setUTCDate(mostRecent10AM_UTC.getUTCDate() - 1)
    }

    if (aliasData.last_extended_at) {
      const lastExtended = new Date(aliasData.last_extended_at)
      if (lastExtended.getTime() > mostRecent10AM_UTC.getTime()) {
        return new Response(JSON.stringify({ error: 'You can only extend once per day. Resets at 10 AM.' }), { status: 403, headers: corsHeaders })
      }
    }

    // Extend time by 24h from current expiration (or from now if already expired)
    const currentExpiry = new Date(aliasData.expires_at).getTime()
    const baseTime = Math.max(now.getTime(), currentExpiry)
    
    const { error: updateError } = await supabaseAdmin
      .from('email_aliases')
      .update({
        expires_at: new Date(baseTime + 24 * 60 * 60 * 1000).toISOString(),
        last_extended_at: now.toISOString()
      })
      .eq('id', aliasData.id)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to extend alias' }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ message: 'Extended successfully' }), { status: 200, headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})

