import "dotenv/config";
import app from "./app";
import env from "./config/env";
import prisma from "./lib/prisma";
import { connectRedis } from "./lib/redis";
import logger from "./lib/logger";

async function start() {
	await prisma.$connect();
	logger.info("Prisma Database connected");

	await connectRedis();

	app.listen(env.PORT, () => {
		logger.info(`Server running on http://localhost:${env.PORT}`);
	});
}

start().catch((err) => {
	logger.error("Failed to start server", { error: err });
	process.exit(1);
});
