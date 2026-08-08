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
      return new Response(JSON.stringify({ error: authError?.message || 'Unauthorized: No user found' }), { status: 401, headers: corsHeaders })
    }

    let body;
    try {
      body = await req.json()
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders })
    }
    const { alias } = body;

    if (!alias) {
      return new Response(JSON.stringify({ error: 'Alias is required' }), { status: 400, headers: corsHeaders })
    }

    // Verify alias belongs to user
    const { data: aliasData, error: fetchError } = await supabaseClient
      .from('email_aliases')
      .select('id, alias')
      .eq('alias', alias)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !aliasData) {
      return new Response(JSON.stringify({ error: 'Alias not found or unauthorized' }), { status: 403, headers: corsHeaders })
    }

    const domain = Deno.env.get('EMAIL_DOMAIN')
    const improvmxKey = Deno.env.get('IMPROVMX_API_KEY')

    if (!domain || !improvmxKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: corsHeaders })
    }

    // Call ImprovMX to delete
    const basicAuth = btoa(`api:${improvmxKey}`)
    const imxRes = await fetch(`https://api.improvmx.com/v3/domains/${domain}/aliases/${alias}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
      }
    })

    if (!imxRes.ok && imxRes.status !== 404) {
      const text = await imxRes.text()
      return new Response(JSON.stringify({ error: `ImprovMX deletion failed: ${text}` }), { status: 500, headers: corsHeaders })
    }

    // Delete from Database
    const { error: deleteError } = await supabaseClient
      .from('email_aliases')
      .delete()
      .eq('id', aliasData.id)

    if (deleteError) {
      return new Response(JSON.stringify({ error: 'Failed to delete alias from database' }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})

