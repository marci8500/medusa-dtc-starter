import {
  defineConfig,
  loadEnv,
} from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const databasePoolMin = Number.parseInt(
  process.env.DATABASE_POOL_MIN || "2",
  10
)

const databasePoolMax = Number.parseInt(
  process.env.DATABASE_POOL_MAX || "10",
  10
)

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,

    databaseDriverOptions: {
      pool: {
        min: databasePoolMin,
        max: databasePoolMax,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
      },
    },

    workerMode: (
      process.env.MEDUSA_WORKER_MODE || "shared"
    ) as "shared" | "server" | "worker",

    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET!,
      cookieSecret: process.env.COOKIE_SECRET!,
    },
  },

  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
    backendUrl: process.env.MEDUSA_BACKEND_URL,
  },
})