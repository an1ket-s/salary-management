import { Router } from "express";
import namesRoutes from "./names";
import seedRoutes  from "./seed";

const router = Router();

router.use("/names", namesRoutes);
router.use("/seed",  seedRoutes);

export default router;
