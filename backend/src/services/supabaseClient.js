import { createClient } from '@supabase/supabase-js';

import { config, getSupabaseConfigurationError } from '../config/env.js';

export function createSupabaseClient(activeConfig = config) {
  const configurationError = getSupabaseConfigurationError(activeConfig);
  if (configurationError) throw new Error(configurationError);

  return createClient(activeConfig.supabaseUrl, activeConfig.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
