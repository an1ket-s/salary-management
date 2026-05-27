import { Router } from "express";
import { insightsController } from "../controllers/insights.js";

const router = Router();

router.get("/",             insightsController.get);
router.get("/hiring-trend", insightsController.getHiringTrend);

export default router;
