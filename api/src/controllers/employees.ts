import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { employeesService } from "../services/employees";

const createSchema = z.object({
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	phone: z.string().min(1),
	email: z.string().email(),
	role: z.string().min(1),
	department: z.string().min(1),
	country: z.string().min(1),
	salary: z.number().positive(),
	joiningDate: z.string().transform((s) => new Date(s)),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().min(3).optional(),
	country: z.string().optional(),
	department: z.string().optional(),
	role: z.string().optional(),
	sortBy: z
		.enum(["firstName", "lastName", "salary", "joiningDate", "createdAt"])
		.optional(),
	sortOrder: z.enum(["asc", "desc"]).optional(),
});

function parseId(raw: string | string[], res: Response): number | null {
	const id = parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
	if (isNaN(id)) {
		res.status(400).json({ error: "Invalid employee id" });
		return null;
	}
	return id;
}

export const employeesController = {
	async list(req: Request, res: Response, next: NextFunction) {
		try {
			const parsed = listQuerySchema.safeParse(req.query);
			if (!parsed.success) {
				res.status(400).json({
					error: "Invalid query parameters",
					details: parsed.error.flatten().fieldErrors,
				});
				return;
			}
			const { page, limit, ...filters } = parsed.data;
			const { data, total } = await employeesService.findMany({
				page,
				limit,
				...filters,
			});
			res.json({
				data,
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			});
		} catch (err) {
			next(err);
		}
	},

	async getById(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseId(req.params.id, res);
			if (id === null) return;
			const employee = await employeesService.findById(id);
			res.json({ data: employee });
		} catch (err) {
			next(err);
		}
	},

	async create(req: Request, res: Response, next: NextFunction) {
		try {
			const parsed = createSchema.safeParse(req.body);
			if (!parsed.success) {
				res.status(400).json({
					error: "Validation failed",
					details: parsed.error.flatten().fieldErrors,
				});
				return;
			}
			const employee = await employeesService.create(parsed.data);
			res.status(201).json({ data: employee });
		} catch (err) {
			next(err);
		}
	},

	async update(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseId(req.params.id, res);
			if (id === null) return;
			const parsed = updateSchema.safeParse(req.body);
			if (!parsed.success) {
				res.status(400).json({
					error: "Validation failed",
					details: parsed.error.flatten().fieldErrors,
				});
				return;
			}
			const employee = await employeesService.update(id, parsed.data);
			res.json({ data: employee });
		} catch (err) {
			next(err);
		}
	},

	async remove(req: Request, res: Response, next: NextFunction) {
		try {
			const id = parseId(req.params.id, res);
			if (id === null) return;
			await employeesService.remove(id);
			res.status(204).send();
		} catch (err) {
			next(err);
		}
	},

	async getMeta(req: Request, res: Response, next: NextFunction) {
		try {
			const meta = await employeesService.getMeta();
			res.json({ data: meta });
		} catch (err) {
			next(err);
		}
	},
};
