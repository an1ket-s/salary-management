import { beforeEach, afterAll } from "vitest";
import prisma from "../lib/prisma";

beforeEach(async () => {
  await prisma.employee.deleteMany();
  await prisma.nameBank.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
