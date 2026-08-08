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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const domain = Deno.env.get('EMAIL_DOMAIN')
    const improvMxKey = Deno.env.get('IMPROVMX_API_KEY')

    if (!domain || !improvMxKey) {
      throw new Error('Missing EMAIL_DOMAIN or IMPROVMX_API_KEY environment variables')
    }

    // Find aliases that have expired
    const now = new Date().toISOString()
    const { data: expiredAliases, error } = await supabaseAdmin
      .from('email_aliases')
      .select(`
        id,
        alias,
        user_id,
        profiles (
          premium_until,
          is_admin
        )
      `)
      .lt('expires_at', now)

    if (error) {
      throw error
    }

    if (!expiredAliases || expiredAliases.length === 0) {
      return new Response(JSON.stringify({ message: 'No expired aliases' }), { status: 200, headers: corsHeaders })
    }

    let deletedCount = 0

    for (const record of expiredAliases) {
      // Check if user is premium
      const profile = Array.isArray(record.profiles) ? record.profiles[0] : record.profiles
      const isPremium = profile?.is_admin || (profile?.premium_until && new Date(profile.premium_until) > new Date())

      if (!isPremium) {
        // Not premium, so delete from ImprovMX
        const res = await fetch(`https://api.improvmx.com/v3/domains/${domain}/aliases/${record.alias}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${btoa(`api:${improvMxKey}`)}`,
            'Content-Type': 'application/json'
          }
        })

        // Only delete from DB if ImprovMX succeeded or if it was already deleted (404)
        if (res.ok || res.status === 404) {
          await supabaseAdmin.from('email_aliases').delete().eq('id', record.id)
          deletedCount++
        }
      } else {
        // They are premium, we should probably update their expires_at so it doesn't get queried every time
        await supabaseAdmin.from('email_aliases').update({
          expires_at: new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() // Push 1 year ahead
        }).eq('id', record.id)
      }
    }

    return new Response(JSON.stringify({ message: `Deleted ${deletedCount} aliases` }), { status: 200, headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})

