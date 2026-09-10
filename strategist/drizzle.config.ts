import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './strategist/src/db/schema.ts',
  out: './strategist/migrations',
})
