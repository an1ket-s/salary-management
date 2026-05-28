import winston from "winston";
import env from "../config/env.js";

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const DEV_FORMAT = combine(
	colorize({ all: true }),
	timestamp({ format: "HH:mm:ss" }),
	errors({ stack: true }),
	printf(({ level, message, timestamp, stack, ...meta }) => {
		const extras =
			Object.keys(meta).length > 0 ? " " + JSON.stringify(meta) : "";
		return `${timestamp} [${level}] ${stack ?? message}${extras}`;
	})
);

const PROD_FORMAT = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
	level: env.NODE_ENV === "production" ? "info" : "debug",
	format: env.NODE_ENV === "production" ? PROD_FORMAT : DEV_FORMAT,
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({
			filename: "logs/error.log",
			level: "error",
			format: combine(timestamp(), errors({ stack: true }), json()),
		}),
		new winston.transports.File({
			filename: "logs/combined.log",
			format: combine(timestamp(), errors({ stack: true }), json()),
		}),
	],
	exceptionHandlers: [
		new winston.transports.File({ filename: "logs/exceptions.log" }),
	],
	rejectionHandlers: [
		new winston.transports.File({ filename: "logs/rejections.log" }),
	],
});

export default logger;
