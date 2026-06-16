import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

// Catch unconfigured env vars early so the failure is obvious in the console
// rather than silently generating broken OAuth / API URLs.
if (import.meta.env.DEV) {
  if (!supabaseUrl || supabaseUrl.includes('YOUR_PROJECT')) {
    console.error(
      '[supabase] PUBLIC_SUPABASE_URL is not set.\n' +
      'Copy it from Supabase Dashboard → Settings → API → Project URL\n' +
      'and paste it into lakeformosa/.env'
    );
  }
  if (!supabaseAnonKey || supabaseAnonKey === 'your-anon-key-here') {
    console.error(
      '[supabase] PUBLIC_SUPABASE_ANON_KEY is not set.\n' +
      'Copy it from Supabase Dashboard → Settings → API → Project API keys → anon public\n' +
      'and paste it into lakeformosa/.env'
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'implicit' },
});
