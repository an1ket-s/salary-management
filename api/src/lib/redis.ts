import { createClient } from "redis";
import env from "../config/env.js";
import logger from "./logger.js";

const redis = createClient({
	username: env.REDIS_USERNAME,
	password: env.REDIS_PASSWORD,
	socket: {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
	},
});

redis.on("error", (err: Error) =>
	logger.error("Redis error", { error: err.message }),
);

export async function connectRedis(): Promise<void> {
	try {
		await redis.connect();
		logger.info("Redis connected");
	} catch (err) {
		logger.error("Redis connection failed — running without cache", {
			error: err,
		});
	}
}

export default redis;
