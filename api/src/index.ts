import "dotenv/config";
import app from "./app";
import env from "./config/env";
import prisma from "./lib/prisma";

async function start() {
  await prisma.$connect();
  console.log("Database connected");

  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
