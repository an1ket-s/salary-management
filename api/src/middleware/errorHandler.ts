import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Prisma unique constraint violation
  if (err.message.includes("Unique constraint")) {
    res.status(409).json({ error: "A record with that value already exists" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
