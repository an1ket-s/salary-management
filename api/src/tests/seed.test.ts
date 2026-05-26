import { describe, it, expect, beforeEach } from "vitest";
import prisma from "../lib/prisma";
import { seedService } from "../services/seed";

const firstNames = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank"];
const lastNames  = ["Smith", "Jones", "Brown", "White", "Green", "Black", "Clark", "Davis"];

describe("SeedService", () => {
  beforeEach(async () => {
    await prisma.nameBank.createMany({
      data: [
        ...firstNames.map((v) => ({ value: v, type: "FIRST" })),
        ...lastNames.map((v) => ({ value: v, type: "LAST" })),
      ],
    });
  });

  describe("seedEmployees", () => {
    it("should insert exactly the requested number of employees", async () => {
      await seedService.seedEmployees(50);
      expect(await prisma.employee.count()).toBe(50);
    });

    it("should generate unique emails for every employee", async () => {
      await seedService.seedEmployees(50);
      const emails = await prisma.employee.findMany({ select: { email: true } });
      const unique = new Set(emails.map((e) => e.email));
      expect(unique.size).toBe(50);
    });

    it("should assign a positive salary to every employee", async () => {
      await seedService.seedEmployees(20);
      const employees = await prisma.employee.findMany({ select: { salary: true } });
      expect(employees.every((e) => e.salary > 0)).toBe(true);
    });

    it("should throw if the name bank has no first names", async () => {
      await prisma.nameBank.deleteMany({ where: { type: "FIRST" } });
      await expect(seedService.seedEmployees(10)).rejects.toThrow("Name bank is empty");
    });

    it("should throw if the name bank has no last names", async () => {
      await prisma.nameBank.deleteMany({ where: { type: "LAST" } });
      await expect(seedService.seedEmployees(10)).rejects.toThrow("Name bank is empty");
    });

    it("should append to existing employees on subsequent seeds", async () => {
      await seedService.seedEmployees(10);
      await seedService.seedEmployees(20);
      expect(await prisma.employee.count()).toBe(30);
    });

    it("should not create duplicate emails across multiple seed runs", async () => {
      await seedService.seedEmployees(20);
      await seedService.seedEmployees(20);
      const emails = await prisma.employee.findMany({ select: { email: true } });
      const unique = new Set(emails.map((e) => e.email));
      expect(unique.size).toBe(40);
    });

    it("should handle counts that span multiple batches of 500", async () => {
      await seedService.seedEmployees(1001);
      expect(await prisma.employee.count()).toBe(1001);
    });

    it("should respect emails already in the DB when generating (no clearAll scenario)", async () => {
      // Pre-populate an employee with a known email
      await prisma.employee.create({
        data: {
          firstName: "Alice", lastName: "Smith", phone: "+1", role: "Engineer",
          department: "Engineering", country: "India", salary: 100,
          email: "alice.smith@incubyte.com",
        },
      });
      // Manually call loadExistingEmails to verify it picks up the existing email
      const { seedRepository } = await import("../repositories/seed");
      const emails = await seedRepository.loadExistingEmails();
      expect(emails.has("alice.smith@incubyte.com")).toBe(true);
    });

    it("should use firstname.lastname@incubyte.com as the primary email format", async () => {
      await prisma.nameBank.deleteMany();
      await prisma.nameBank.createMany({
        data: [
          { value: "Alice", type: "FIRST" },
          { value: "Smith", type: "LAST" },
        ],
      });
      await seedService.seedEmployees(1);
      const [emp] = await prisma.employee.findMany();
      expect(emp.email).toBe("alice.smith@incubyte.com");
    });

    it("should fall back to firstname.L@incubyte.com on first collision", async () => {
      await prisma.nameBank.deleteMany();
      await prisma.nameBank.createMany({
        data: [
          { value: "Alice", type: "FIRST" },
          { value: "Smith", type: "LAST" },
        ],
      });
      await seedService.seedEmployees(2);
      const emails = (await prisma.employee.findMany({ select: { email: true } })).map((e) => e.email);
      expect(emails).toContain("alice.smith@incubyte.com");
      expect(emails).toContain("alice.s@incubyte.com");
    });

    it("should fall back to F.lastname@incubyte.com on second collision", async () => {
      await prisma.nameBank.deleteMany();
      await prisma.nameBank.createMany({
        data: [
          { value: "Alice", type: "FIRST" },
          { value: "Smith", type: "LAST" },
        ],
      });
      await seedService.seedEmployees(3);
      const emails = (await prisma.employee.findMany({ select: { email: true } })).map((e) => e.email);
      expect(emails).toContain("alice.smith@incubyte.com");
      expect(emails).toContain("alice.s@incubyte.com");
      expect(emails).toContain("a.smith@incubyte.com");
    });
  });
});
