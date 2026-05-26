import { Request, Response, NextFunction } from "express";
import { Readable } from "stream";
import { namesService } from "../services/names";
import { AppError } from "../middleware/errorHandler";

export const namesController = {
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = req.body.type as "FIRST" | "LAST";
      if (type !== "FIRST" && type !== "LAST") {
        throw new AppError(400, 'type must be "FIRST" or "LAST"');
      }
      if (!req.file) {
        throw new AppError(400, "No file uploaded");
      }

      const stream = Readable.from(req.file.buffer);
      const result = await namesService.processNamesStream(stream, type);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  },

  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await namesService.getNameStats();
      res.status(200).json({ data: stats });
    } catch (err) {
      next(err);
    }
  },
};
