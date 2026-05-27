import { Request, Response, NextFunction } from "express";
import { insightsService } from "../services/insights.js";
import type { TrendBy } from "../repositories/insights.js";

const VALID_TREND: TrendBy[] = ["week", "month", "year"];

function parseCountry(req: Request): string | undefined {
  const c = req.query.country;
  return typeof c === "string" && c.trim() ? c.trim() : undefined;
}

function parseTrendBy(req: Request): TrendBy {
  const t = req.query.trendBy;
  return typeof t === "string" && VALID_TREND.includes(t as TrendBy)
    ? (t as TrendBy)
    : "year";
}

function parseStrParam(req: Request, key: string): string | undefined {
  const v = req.query[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const insightsController = {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await insightsService.getInsights(parseCountry(req));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },

  async getHiringTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await insightsService.getHiringTrend(
        parseCountry(req),
        parseTrendBy(req),
        parseStrParam(req, "year"),
        parseStrParam(req, "month"),
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
};
