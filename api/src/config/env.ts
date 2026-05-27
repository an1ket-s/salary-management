const env = {
  PORT:           parseInt(process.env.PORT ?? "3001", 10),
  DATABASE_URL:   process.env.DATABASE_URL ?? "file:./dev.db",
  NODE_ENV:       process.env.NODE_ENV ?? "development",
  REDIS_HOST:     process.env.REDIS_HOST ?? "localhost",
  REDIS_PORT:     parseInt(process.env.REDIS_PORT ?? "6379", 10),
  REDIS_USERNAME: process.env.REDIS_USERNAME ?? "default",
  REDIS_PASSWORD:          process.env.REDIS_PASSWORD ?? "",
  EXCHANGE_RATE_API_KEY:   process.env.EXCHANGE_RATE_API_KEY ?? "",
};

export default env;
