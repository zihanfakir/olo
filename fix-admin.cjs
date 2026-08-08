const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Read .env file
const envFile = fs.readFileSync('.env', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=')
  if (key && values.length > 0) {
    env[key.trim()] = values.join('=').trim()
  }
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data, error } = await supabase.from('profiles').update({ is_admin: true }).eq('email', 'zihanfakir@gmail.com')
  console.log('Update Result:', error || 'Success')
  
  const { data: profile } = await supabase.from('profiles').select('*').eq('email', 'zihanfakir@gmail.com')
  console.log('Profile:', profile)
}

run()
