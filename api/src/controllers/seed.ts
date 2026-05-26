import { Request, Response, NextFunction } from "express";
import { seedService } from "../services/seed";

export const seedController = {
  async seed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = parseInt(req.body.count ?? "10000", 10);
      const result = await seedService.seedEmployees(count);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
};
