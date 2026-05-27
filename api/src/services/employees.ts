import type { Employee } from "@prisma/client";
import {
	employeesRepository,
	CreateEmployeeInput,
	UpdateEmployeeInput,
	EmployeeFilters,
} from "../repositories/employees.js";
import { AppError } from "../middleware/errorHandler.js";
import { cache } from "../lib/cache.js";

const EMP_TTL = 3_600; // 1 h
const META_TTL = 1_800; // 30 min

const META_KEY = "emp:meta";
const empKey = (email: string) => `emp:${email}`;
const ptrKey = (id: number) => `emp:ptr:${id}`;

export const employeesService = {
	async findMany(filters: EmployeeFilters) {
		return employeesRepository.findMany(filters);
	},

	async findById(id: number): Promise<Employee> {
		// 1. pointer lookup: emp:ptr:{id} → email → emp:{email}
		const email = await cache.get<string>(ptrKey(id));
		if (email) {
			const hit = await cache.get<Employee>(empKey(email));
			if (hit) return hit;
		}

		// 2. DB miss — fetch and warm cache
		const employee = await employeesRepository.findById(id);
		if (!employee) throw new AppError(404, "Employee not found");

		await Promise.all([
			cache.set(empKey(employee.email), employee, EMP_TTL),
			cache.set(ptrKey(id), employee.email, EMP_TTL),
		]);

		return employee;
	},

	async create(data: CreateEmployeeInput): Promise<Employee> {
		const employee = await employeesRepository.create(data);
		await Promise.all([
			cache.set(empKey(employee.email), employee, EMP_TTL),
			cache.set(ptrKey(employee.id), employee.email, EMP_TTL),
			cache.del(META_KEY),
			cache.delByPattern("insights:*"),
			cache.delByPattern("trend:*"),
		]);
		return employee;
	},

	async update(id: number, data: UpdateEmployeeInput): Promise<Employee> {
		const existing = await employeesService.findById(id); // 404 guard + warms cache
		const employee = await employeesRepository.update(id, data);

		// invalidate old keys (handles edge case where email changed)
		await Promise.all([
			cache.del(empKey(existing.email), ptrKey(id)),
			cache.delByPattern("insights:*"),
			cache.delByPattern("trend:*"),
		]);

		// re-cache updated record
		await Promise.all([
			cache.set(empKey(employee.email), employee, EMP_TTL),
			cache.set(ptrKey(id), employee.email, EMP_TTL),
		]);

		return employee;
	},

	async remove(id: number): Promise<void> {
		const existing = await employeesService.findById(id); // 404 guard
		await employeesRepository.remove(id);
		await Promise.all([
			cache.del(empKey(existing.email), ptrKey(id), META_KEY),
			cache.delByPattern("insights:*"),
			cache.delByPattern("trend:*"),
		]);
	},

	async getMeta() {
		const hit = await cache.get(META_KEY);
		if (hit) return hit;

		const meta = await employeesRepository.getMeta();
		await cache.set(META_KEY, meta, META_TTL);
		return meta;
	},
};
