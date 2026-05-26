import { Router } from "express";
import { seedController } from "../controllers/seed";

const router = Router();

router.post("/", seedController.seed);

export default router;
