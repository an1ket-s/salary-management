import { afterEach, afterAll } from "vitest";
import prisma from "../lib/prisma";

afterEach(async () => {
  await prisma.employee.deleteMany();
  await prisma.nameBank.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
