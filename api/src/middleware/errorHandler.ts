import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import logger from "../lib/logger.js";

export class AppError extends Error {
	constructor(
		public statusCode: number,
		message: string,
	) {
		super(message);
		this.name = "AppError";
	}
}

export function errorHandler(
	err: Error,
	_req: Request,
	res: Response,
	_next: NextFunction,
): void {
	const meta = {
		method: _req.method,
		url: _req.originalUrl,
	};
	if (err instanceof AppError) {
		logger.error("AppError", {
			error: err.message,
			meta,
		});
		res.status(err.statusCode).json({ error: err.message });
		return;
	}

	if (err instanceof Prisma.PrismaClientKnownRequestError) {
		if (err.code === "P2002") {
			logger.error("Unique constraint violation", {
				error: err.message,
				meta,
			});
			res
				.status(409)
				.json({ error: "A record with that value already exists" });
			return;
		}
		if (err.code === "P2025") {
			logger.error("Record not found", {
				error: err.message,
				meta,
			});
			res.status(404).json({ error: "Record not found" });
			return;
		}
	}

	logger.error("Unhandled error", { error: err.message, stack: err.stack });
	res.status(500).json({ error: "Internal server error" });
}
