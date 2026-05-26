import prisma from "../lib/prisma";

export const seedRepository = {
  async bulkInsert(employees: object[]): Promise<void> {
    await prisma.employee.createMany({ data: employees as any });
  },

  async loadExistingEmails(): Promise<Set<string>> {
    const rows = await prisma.employee.findMany({ select: { email: true } });
    return new Set(rows.map((r) => r.email));
  },
};
