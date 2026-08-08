import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const RESERVED_NAMES = [
  "admin", "support", "postmaster", "abuse", "root",
  "webmaster", "info", "contact", "noreply", "security",
  "apple", "google", "microsoft", "facebook", "meta", "amazon",
  "netflix", "zihan", "zihanfakir", "owner", "ceo", "founder"
]

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
    
    // We need service role key to bypass RLS for counting total user aliases across all users or enforcing limit
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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
    const { username, gmail } = body;

    // Validate username
    if (!username || !/^[a-z0-9._-]{3,30}$/.test(username)) {
      return new Response(JSON.stringify({ error: 'Invalid username format' }), { status: 400, headers: corsHeaders })
    }

    if (RESERVED_NAMES.includes(username)) {
      return new Response(JSON.stringify({ error: 'Username is reserved' }), { status: 400, headers: corsHeaders })
    }

    // Validate gmail
    if (!gmail || !gmail.endsWith('@gmail.com')) {
      return new Response(JSON.stringify({ error: 'Only Gmail addresses are supported for forwarding' }), { status: 400, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if alias is globally taken in DB
    const { data: globallyTaken } = await supabaseAdmin
      .from('email_aliases')
      .select('id')
      .eq('alias', username)
      .maybeSingle()

    if (globallyTaken) {
      return new Response(JSON.stringify({ error: 'This username is already taken. Please try another one.' }), { status: 400, headers: corsHeaders })
    }

    // Enforce max 1 alias per user
    const { data: existingAliases, error: countError } = await supabaseAdmin
      .from('email_aliases')
      .select('id')
      .eq('user_id', user.id)

    if (countError) {
      return new Response(JSON.stringify({ error: 'Database error counting aliases' }), { status: 500, headers: corsHeaders })
    }

    if (existingAliases && existingAliases.length >= 1) {
      return new Response(JSON.stringify({ error: 'Alias limit reached (max 1 per user)' }), { status: 403, headers: corsHeaders })
    }

    // Check for trial abuse: prevent swapping forward email to an already-trial-used email if currently premium
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('premium_until, is_admin')
      .eq('id', user.id)
      .single()

    const isPremium = profile?.is_admin || (profile?.premium_until && new Date(profile.premium_until) > new Date())
    
    if (isPremium && !profile?.is_admin) {
      const { data: historyMatch } = await supabaseAdmin
        .from('trial_history')
        .select('id')
        .neq('user_id', user.id)
        .or(`account_email.eq.${gmail},forward_to_email.eq.${gmail}`)
        .limit(1)
        .maybeSingle()

      if (historyMatch) {
        return new Response(JSON.stringify({ error: 'This forward address has already been used for a trial on another account.' }), { status: 403, headers: corsHeaders })
      }

      // Add to trial_history to prevent future abuse by other accounts
      await supabaseAdmin.from('trial_history').insert({
        user_id: user.id,
        account_email: user.email,
        forward_to_email: gmail
      })
    }

    const domain = Deno.env.get('EMAIL_DOMAIN')
    const improvmxKey = Deno.env.get('IMPROVMX_API_KEY')

    if (!domain || !improvmxKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: corsHeaders })
    }

    // ImprovMX API call
    const basicAuth = btoa(`api:${improvmxKey}`)
    const imxRes = await fetch(`https://api.improvmx.com/v3/domains/${domain}/aliases`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        alias: username,
        forward: gmail
      })
    })

    const imxData = await imxRes.json()

    if (!imxRes.ok) {
      let errorMessage = 'Failed to create alias on ImprovMX';
      if (typeof imxData.error === 'string') {
        errorMessage = imxData.error;
      } else if (imxData.error && typeof imxData.error === 'object') {
        const errorValues = Object.values(imxData.error).flat().join(', ');
        if (errorValues.includes('taken') || errorValues.includes('exist')) {
          errorMessage = 'This username is already taken on our mail server. Please try another one.';
        } else {
          errorMessage = errorValues || errorMessage;
        }
      }
      return new Response(JSON.stringify({ error: errorMessage }), { status: 400, headers: corsHeaders })
    }

    // Insert into DB
    const { error: insertError } = await supabaseClient
      .from('email_aliases')
      .insert({
        user_id: user.id,
        alias: username,
        forward_to: gmail,
        improvmx_id: imxData.alias?.id?.toString() || ''
      })

    if (insertError) {
      // Rollback: try to delete from ImprovMX since DB insert failed
      await fetch(`https://api.improvmx.com/v3/domains/${domain}/aliases/${username}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
        }
      })
      return new Response(JSON.stringify({ error: 'Failed to save alias in database' }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ success: true, alias: username, domain }), { headers: corsHeaders, status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})

