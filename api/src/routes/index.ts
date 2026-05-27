import { Router } from "express";
import namesRoutes     from "./names";
import seedRoutes      from "./seed";
import employeesRoutes from "./employees";
import insightsRoutes  from "./insights";

const router = Router();

router.use("/names",     namesRoutes);
router.use("/seed",      seedRoutes);
router.use("/employees", employeesRoutes);
router.use("/insights",  insightsRoutes);

export default router;
