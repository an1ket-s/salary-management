import { Readable } from "stream";
import { describe, it, expect, beforeEach } from "vitest";
import prisma from "../lib/prisma";
import { namesService } from "../services/names";

const makeStream = (content: string) => Readable.from(Buffer.from(content));

describe("NamesService", () => {
  describe("processNamesStream", () => {
    it("should parse names and insert into NameBank", async () => {
      const result = await namesService.processNamesStream(
        makeStream("Alice\nBob\nCharlie\n"),
        "FIRST"
      );
      expect(result.inserted).toBe(3);
      const count = await prisma.nameBank.count({ where: { type: "FIRST" } });
      expect(count).toBe(3);
    });

    it("should skip empty lines and whitespace-only lines", async () => {
      const result = await namesService.processNamesStream(
        makeStream("Alice\n\n  \nBob\n"),
        "FIRST"
      );
      expect(result.inserted).toBe(2);
    });

    it("should replace existing names of the same type on re-upload", async () => {
      await prisma.nameBank.createMany({
        data: [{ value: "OldName", type: "FIRST" }],
      });
      await namesService.processNamesStream(
        makeStream("NewName1\nNewName2\n"),
        "FIRST"
      );
      const names = await prisma.nameBank.findMany({ where: { type: "FIRST" } });
      expect(names.map((n) => n.value)).toEqual(["NewName1", "NewName2"]);
    });

    it("should not affect names of the other type", async () => {
      await prisma.nameBank.createMany({
        data: [{ value: "Smith", type: "LAST" }],
      });
      await namesService.processNamesStream(
        makeStream("Alice\n"),
        "FIRST"
      );
      const lastCount = await prisma.nameBank.count({ where: { type: "LAST" } });
      expect(lastCount).toBe(1);
    });

    it("should handle large files in batches without error", async () => {
      const bigContent = Array.from({ length: 1200 }, (_, i) => `Name${i}`).join("\n");
      const result = await namesService.processNamesStream(
        makeStream(bigContent),
        "LAST"
      );
      expect(result.inserted).toBe(1200);
    });
  });

  describe("getNameStats", () => {
    beforeEach(async () => {
      await prisma.nameBank.createMany({
        data: [
          { value: "Alice", type: "FIRST" },
          { value: "Bob", type: "FIRST" },
          { value: "Smith", type: "LAST" },
        ],
      });
    });

    it("should return correct counts for each type", async () => {
      const stats = await namesService.getNameStats();
      expect(stats.firstNames).toBe(2);
      expect(stats.lastNames).toBe(1);
    });
  });
});
