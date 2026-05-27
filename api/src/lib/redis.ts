import { createClient } from "redis";
import env from "../config/env.js";

const redis = createClient({
  username: env.REDIS_USERNAME,
  password: env.REDIS_PASSWORD,
  socket: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
});

redis.on("error", (err: Error) => console.error("[Redis]", err.message));

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    console.log("[Redis] Connected");
  } catch (err) {
    console.error("[Redis] Connection failed — running without cache:", err);
  }
}

export default redis;
