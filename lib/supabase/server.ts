import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/lib/env/server";
import type { Database } from "./database.types";

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseServerEnv();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
