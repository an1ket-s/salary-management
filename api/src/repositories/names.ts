import prisma from "../lib/prisma";

const BATCH_SIZE = 500;

export const namesRepository = {
  async bulkInsert(records: { value: string; type: string }[]): Promise<void> {
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      await prisma.nameBank.createMany({ data: records.slice(i, i + BATCH_SIZE) });
    }
  },

  async deleteByType(type: string): Promise<void> {
    await prisma.nameBank.deleteMany({ where: { type } });
  },

  async countByType(type: string): Promise<number> {
    return prisma.nameBank.count({ where: { type } });
  },

  async findAllByType(type: string): Promise<string[]> {
    const rows = await prisma.nameBank.findMany({
      where: { type },
      select: { value: true },
    });
    return rows.map((r) => r.value);
  },
};
