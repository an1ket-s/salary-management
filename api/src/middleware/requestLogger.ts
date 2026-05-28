import { Request, NextFunction, Response } from "express";
import logger from "../lib/logger";

export const requestLogger = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const status: number = res.statusCode;
	res.on("finish", () => {
		switch (status) {
			case 400:
			case 401:
			case 404:
			case 409:
			case 500:
				logger.error("Request completed with client error", {
					method: req.method,
					url: req.originalUrl,
					status,
				});
				break;
			case 200:
			case 304:
			default:
				logger.info("Request:", {
					method: req.method,
					url: req.originalUrl,
					status,
				});
		}
	});
	next();
};
