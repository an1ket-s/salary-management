import prisma from "../lib/prisma";

export interface EmployeeFilters {
	search?: string;
	country?: string;
	department?: string;
	role?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	page: number;
	limit: number;
}

export interface CreateEmployeeInput {
	firstName: string;
	lastName: string;
	phone: string;
	email: string;
	role: string;
	department: string;
	country: string;
	salary: number;
	joiningDate: Date;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

const ALLOWED_SORT = new Set([
	"firstName",
	"lastName",
	"salary",
	"joiningDate",
	"createdAt",
]);

function buildWhere(f: EmployeeFilters) {
	return {
		...(f.search && {
			OR: [
				{ firstName: { contains: f.search, mode: "insensitive" as const } },
				{ lastName: { contains: f.search, mode: "insensitive" as const } },
				{ email: { contains: f.search, mode: "insensitive" as const } },
			],
		}),
		...(f.country && { country: f.country }),
		...(f.department && { department: f.department }),
		...(f.role && { role: f.role }),
	};
}

export const employeesRepository = {
	async findMany(filters: EmployeeFilters) {
		const where = buildWhere(filters);
		const sortBy = ALLOWED_SORT.has(filters.sortBy ?? "")
			? filters.sortBy!
			: "createdAt";
		const skip = (filters.page - 1) * filters.limit;

		const [data, total] = await prisma.$transaction([
			prisma.employee.findMany({
				where,
				orderBy: { [sortBy]: filters.sortOrder ?? "desc" },
				skip,
				take: filters.limit,
			}),
			prisma.employee.count({ where }),
		]);

		return { data, total };
	},

	async findById(id: number) {
		return prisma.employee.findUnique({ where: { id } });
	},

	async create(data: CreateEmployeeInput) {
		return prisma.employee.create({ data });
	},

	async update(id: number, data: UpdateEmployeeInput) {
		return prisma.employee.update({ where: { id }, data });
	},

	async remove(id: number) {
		return prisma.employee.delete({ where: { id } });
	},

	async getMeta() {
		const [countries, departments, roles] = await prisma.$transaction([
			prisma.employee.findMany({
				select: { country: true },
				distinct: ["country"],
				orderBy: { country: "asc" },
			}),
			prisma.employee.findMany({
				select: { department: true },
				distinct: ["department"],
				orderBy: { department: "asc" },
			}),
			prisma.employee.findMany({
				select: { role: true },
				distinct: ["role"],
				orderBy: { role: "asc" },
			}),
		]);
		return {
			countries: countries.map((r) => r.country),
			departments: departments.map((r) => r.department),
			roles: roles.map((r) => r.role),
		};
	},
};
