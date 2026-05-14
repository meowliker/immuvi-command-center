function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getSupabaseServerEnv() {
  return {
    url: requiredEnv("SUPABASE_URL"),
    serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  };
}

export function getInstallSkillEnv() {
  return {
    secret: requiredEnv("INSTALL_SKILL_SECRET"),
    serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    dbPassword: requiredEnv("SUPABASE_DB_PASSWORD")
  };
}
