import { Router } from "express";
import { employeesController } from "../controllers/employees";

const router = Router();

// /meta must come before /:id so it is not captured as an id param
router.get("/meta",   employeesController.getMeta);
router.get("/",       employeesController.list);
router.get("/:id",    employeesController.getById);
router.post("/",      employeesController.create);
router.put("/:id",    employeesController.update);
router.delete("/:id", employeesController.remove);

export default router;
