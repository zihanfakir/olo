import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // 1. Check if user already used trial
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('has_used_trial, premium_until, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: corsHeaders })
    }

    if (profile.has_used_trial) {
      return new Response(JSON.stringify({ error: 'You have already used your 3-day trial.' }), { status: 403, headers: corsHeaders })
    }

    // Check if already premium or admin
    if (profile.is_admin || (profile.premium_until && new Date(profile.premium_until) > new Date())) {
      return new Response(JSON.stringify({ error: 'You are already a premium user.' }), { status: 400, headers: corsHeaders })
    }

    // 2. Get user's forward_to email
    const { data: aliases } = await supabaseAdmin
      .from('email_aliases')
      .select('forward_to')
      .eq('user_id', user.id)

    let forwardToEmail = null
    if (aliases && aliases.length > 0) {
      forwardToEmail = aliases[0].forward_to
    }

    if (!forwardToEmail) {
      return new Response(JSON.stringify({ error: 'You must create an email alias first before activating your free trial.' }), { status: 403, headers: corsHeaders })
    }

    // 3. Check trial_history to prevent multiple accounts using same gmail
    const emailsToCheck = [user.email]
    if (forwardToEmail && forwardToEmail !== user.email) {
      emailsToCheck.push(forwardToEmail)
    }
    
    // Construct the OR query carefully without breaking PostgREST syntax
    // e.g. account_email.eq.foo@gmail.com,forward_to_email.eq.foo@gmail.com
    const orConditions = emailsToCheck.flatMap(email => [
      `account_email.eq.${email}`,
      `forward_to_email.eq.${email}`
    ]).join(',')

    const { data: historyMatch } = await supabaseAdmin
      .from('trial_history')
      .select('id')
      .or(orConditions)
      .limit(1)
      .maybeSingle()

    if (historyMatch) {
      return new Response(JSON.stringify({ error: 'A trial has already been claimed using this email address or forward address.' }), { status: 403, headers: corsHeaders })
    }

    // 4. Grant 3 days premium and mark as used
    const premiumUntil = new Date()
    premiumUntil.setDate(premiumUntil.getDate() + 3)

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        has_used_trial: true,
        premium_until: premiumUntil.toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      throw updateError
    }

    // 5. Log in trial_history
    await supabaseAdmin
      .from('trial_history')
      .insert({
        user_id: user.id,
        account_email: user.email,
        forward_to_email: forwardToEmail
      })

    return new Response(JSON.stringify({ 
      success: true, 
      message: '3-Day Premium Trial activated successfully!',
      premium_until: premiumUntil.toISOString()
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
  }
})
