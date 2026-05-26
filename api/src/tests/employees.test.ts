import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../app";
import prisma from "../lib/prisma";

function makeEmployee(overrides: Record<string, unknown> = {}) {
  return {
    firstName:   "John",
    lastName:    "Doe",
    phone:       "+911234567890",
    email:       "john.doe@incubyte.com",
    role:        "Engineer",
    department:  "Engineering",
    country:     "India",
    salary:      1000000,
    joiningDate: "2022-06-15T00:00:00.000Z",
    ...overrides,
  };
}

async function seedEmployees(count: number, baseOverrides: Record<string, unknown> = {}) {
  return prisma.employee.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      firstName:   `First${i}`,
      lastName:    `Last${i}`,
      phone:       `+91${String(i).padStart(10, "0")}`,
      email:       `first${i}.last${i}@incubyte.com`,
      role:        i % 2 === 0 ? "Engineer" : "Designer",
      department:  i % 2 === 0 ? "Engineering" : "Design",
      country:     i % 2 === 0 ? "India" : "USA",
      salary:      1000000 + i * 10000,
      joiningDate: new Date(2022, 0, i + 1),
      ...baseOverrides,
    })),
  });
}

describe("Employees API", () => {
  // ── LIST ───────────────────────────────────────────────────────────────────

  describe("GET /api/employees", () => {
    it("returns empty list when no employees exist", async () => {
      const res = await request(app).get("/api/employees");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.totalPages).toBe(0);
    });

    it("returns paginated list with total", async () => {
      await seedEmployees(5);
      const res = await request(app).get("/api/employees?limit=3&page=1");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(2);
    });

    it("returns correct slice for page 2", async () => {
      await seedEmployees(5);
      const res = await request(app).get("/api/employees?limit=3&page=2");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it("filters by search (firstName match)", async () => {
      await seedEmployees(3);
      await prisma.employee.create({
        data: makeEmployee({ email: "unique@incubyte.com" }),
      });
      const res = await request(app).get("/api/employees?search=John");
      expect(res.status).toBe(200);
      expect(res.body.data.every((e: { firstName: string }) => e.firstName === "John")).toBe(true);
    });

    it("filters by country", async () => {
      await seedEmployees(4);
      const res = await request(app).get("/api/employees?country=India");
      expect(res.status).toBe(200);
      expect(res.body.data.every((e: { country: string }) => e.country === "India")).toBe(true);
    });

    it("filters by department", async () => {
      await seedEmployees(4);
      const res = await request(app).get("/api/employees?department=Engineering");
      expect(res.status).toBe(200);
      expect(res.body.data.every((e: { department: string }) => e.department === "Engineering")).toBe(true);
    });

    it("filters by role", async () => {
      await seedEmployees(4);
      const res = await request(app).get("/api/employees?role=Designer");
      expect(res.status).toBe(200);
      expect(res.body.data.every((e: { role: string }) => e.role === "Designer")).toBe(true);
    });

    it("sorts by salary ascending", async () => {
      await seedEmployees(3);
      const res = await request(app).get("/api/employees?sortBy=salary&sortOrder=asc");
      expect(res.status).toBe(200);
      const salaries = res.body.data.map((e: { salary: number }) => e.salary);
      expect(salaries).toEqual([...salaries].sort((a, b) => a - b));
    });

    it("returns 400 for invalid query params", async () => {
      const res = await request(app).get("/api/employees?page=abc");
      expect(res.status).toBe(400);
    });
  });

  // ── META ───────────────────────────────────────────────────────────────────

  describe("GET /api/employees/meta", () => {
    it("returns distinct countries, departments, and roles", async () => {
      await seedEmployees(4);
      const res = await request(app).get("/api/employees/meta");
      expect(res.status).toBe(200);
      expect(res.body.data.countries).toContain("India");
      expect(res.body.data.countries).toContain("USA");
      expect(res.body.data.departments).toContain("Engineering");
      expect(res.body.data.roles).toContain("Engineer");
    });

    it("returns empty arrays when no employees exist", async () => {
      const res = await request(app).get("/api/employees/meta");
      expect(res.status).toBe(200);
      expect(res.body.data.countries).toEqual([]);
      expect(res.body.data.departments).toEqual([]);
      expect(res.body.data.roles).toEqual([]);
    });
  });

  // ── GET BY ID ──────────────────────────────────────────────────────────────

  describe("GET /api/employees/:id", () => {
    it("returns employee by id", async () => {
      const emp = await prisma.employee.create({ data: makeEmployee() as any });
      const res = await request(app).get(`/api/employees/${emp.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe("john.doe@incubyte.com");
    });

    it("returns 404 for non-existent id", async () => {
      const res = await request(app).get("/api/employees/99999");
      expect(res.status).toBe(404);
    });

    it("returns 400 for non-numeric id", async () => {
      const res = await request(app).get("/api/employees/abc");
      expect(res.status).toBe(400);
    });
  });

  // ── CREATE ─────────────────────────────────────────────────────────────────

  describe("POST /api/employees", () => {
    it("creates employee and returns 201", async () => {
      const res = await request(app).post("/api/employees").send(makeEmployee());
      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe("john.doe@incubyte.com");
      expect(res.body.data.id).toBeDefined();
    });

    it("returns 409 for duplicate email", async () => {
      await request(app).post("/api/employees").send(makeEmployee());
      const res = await request(app).post("/api/employees").send(makeEmployee());
      expect(res.status).toBe(409);
    });

    it("returns 400 for missing required fields", async () => {
      const res = await request(app).post("/api/employees").send({ firstName: "John" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid email", async () => {
      const res = await request(app).post("/api/employees").send(makeEmployee({ email: "not-an-email" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for negative salary", async () => {
      const res = await request(app).post("/api/employees").send(makeEmployee({ salary: -1 }));
      expect(res.status).toBe(400);
    });
  });

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  describe("PUT /api/employees/:id", () => {
    it("updates employee fields", async () => {
      const emp = await prisma.employee.create({ data: makeEmployee() as any });
      const res = await request(app)
        .put(`/api/employees/${emp.id}`)
        .send({ salary: 2000000, role: "Senior Engineer" });
      expect(res.status).toBe(200);
      expect(res.body.data.salary).toBe(2000000);
      expect(res.body.data.role).toBe("Senior Engineer");
    });

    it("returns 404 for non-existent id", async () => {
      const res = await request(app)
        .put("/api/employees/99999")
        .send({ salary: 2000000 });
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid email in update", async () => {
      const emp = await prisma.employee.create({ data: makeEmployee() as any });
      const res = await request(app)
        .put(`/api/employees/${emp.id}`)
        .send({ email: "bad-email" });
      expect(res.status).toBe(400);
    });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  describe("DELETE /api/employees/:id", () => {
    it("deletes employee and returns 204", async () => {
      const emp = await prisma.employee.create({ data: makeEmployee() as any });
      const res = await request(app).delete(`/api/employees/${emp.id}`);
      expect(res.status).toBe(204);
      expect(await prisma.employee.findUnique({ where: { id: emp.id } })).toBeNull();
    });

    it("returns 404 for non-existent id", async () => {
      const res = await request(app).delete("/api/employees/99999");
      expect(res.status).toBe(404);
    });
  });
});
