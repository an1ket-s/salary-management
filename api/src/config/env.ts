const env = {
  PORT: parseInt(process.env.PORT ?? "3001", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db",
  NODE_ENV: process.env.NODE_ENV ?? "development",
};

export default env;
