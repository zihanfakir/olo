import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
      }
    })
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const body = await req.json()
    let { alias, aliases } = body
    if (!aliases && alias) aliases = [alias]
    if (!aliases || !Array.isArray(aliases)) {
      return new Response(JSON.stringify({ error: 'Missing alias or aliases parameter' }), { status: 400, headers: corsHeaders })
    }

    // 1. Verify that all requested aliases belong to the user
    const { data: userAliases, error: dbError } = await supabaseClient
      .from('email_aliases')
      .select('alias')
      .eq('user_id', user.id)
      .in('alias', aliases)

    if (dbError || !userAliases || userAliases.length === 0) {
      return new Response(JSON.stringify({ error: 'Aliases not found or unauthorized' }), { status: 403, headers: corsHeaders })
    }

    const domain = Deno.env.get('EMAIL_DOMAIN')
    const improvmxKey = Deno.env.get('IMPROVMX_API_KEY')

    if (!domain || !improvmxKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: corsHeaders })
    }

    // Fetch logs from ImprovMX
    const basicAuth = btoa(`api:${improvmxKey}`)
    const imxRes = await fetch(`https://api.improvmx.com/v3/domains/${domain}/logs`, {
      headers: {
        'Authorization': `Basic ${basicAuth}`
      }
    })

    if (!imxRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch logs from ImprovMX' }), { status: 500, headers: corsHeaders })
    }

    const logData = await imxRes.json()
    
    const statsMap: Record<string, number> = {}
    userAliases.forEach(a => statsMap[a.alias] = 0)

    if (logData && logData.logs) {
      logData.logs.forEach((log: any) => {
        userAliases.forEach(a => {
          if (log.recipient === `${a.alias}@${domain}` || log.hostname === a.alias) {
            statsMap[a.alias]++
          }
        })
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      stats: statsMap,
      note: 'Count based on recent logs only.'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})

