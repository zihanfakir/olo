create extension if not exists pg_net;

select
  cron.schedule(
    'cleanup-expired-aliases-job',
    '0 * * * *',
    $$
    select
      net.http_post(
          url:='https://lgmuxmgnycojueudlcuw.supabase.co/functions/v1/cleanup-expired-aliases',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_ycHqCocoB9C26h-Q-0BTSg_4mzfHZUD"}'::jsonb
      ) as request_id;
    $$
  );
