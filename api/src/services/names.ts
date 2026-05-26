import { Readable } from "stream";
import { createInterface } from "readline";
import { namesRepository } from "../repositories/names";

const BATCH_SIZE = 500;

export const namesService = {
  async processNamesStream(
    stream: Readable,
    type: "FIRST" | "LAST"
  ): Promise<{ inserted: number }> {
    await namesRepository.deleteByType(type);

    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let batch: string[] = [];
    let totalInserted = 0;

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      batch.push(trimmed);

      if (batch.length >= BATCH_SIZE) {
        await namesRepository.bulkInsert(batch.map((v) => ({ value: v, type })));
        totalInserted += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      await namesRepository.bulkInsert(batch.map((v) => ({ value: v, type })));
      totalInserted += batch.length;
    }

    return { inserted: totalInserted };
  },

  async getNameStats(): Promise<{ firstNames: number; lastNames: number }> {
    const [firstNames, lastNames] = await Promise.all([
      namesRepository.countByType("FIRST"),
      namesRepository.countByType("LAST"),
    ]);
    return { firstNames, lastNames };
  },
};
