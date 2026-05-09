import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseEnv } from "@/lib/supabase/env";

export const createSupabaseAdminClient = () => {
  const env = getServerSupabaseEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
};
