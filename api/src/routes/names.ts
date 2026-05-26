import { Router } from "express";
import multer from "multer";
import { namesController } from "../controllers/names";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post("/upload", upload.single("file"), namesController.upload);
router.get("/stats", namesController.getStats);

export default router;
