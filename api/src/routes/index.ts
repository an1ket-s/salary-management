import { Router } from "express";
import namesRoutes     from "./names";
import seedRoutes      from "./seed";
import employeesRoutes from "./employees";

const router = Router();

router.use("/names",     namesRoutes);
router.use("/seed",      seedRoutes);
router.use("/employees", employeesRoutes);

export default router;
