import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.NEON_DB_URL!,
  },
  migrations: {
    seed: 'npx ts-node ./prisma/seed.ts', // ou 'bun ./prisma/seed.ts' si vous utilisez Bun
  },
})