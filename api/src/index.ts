import "dotenv/config";
import app from "./app";
import env from "./config/env";
import prisma from "./lib/prisma";
import { connectRedis } from "./lib/redis";

async function start() {
	await prisma.$connect();
	console.log("Database connected");

	await connectRedis();

	app.listen(env.PORT, () => {
		console.log(`Server running on http://localhost:${env.PORT}`);
	});
}

start().catch((err) => {
	console.error("Failed to start server:", err);
	process.exit(1);
});
