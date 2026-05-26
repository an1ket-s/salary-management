import { namesRepository } from "../repositories/names";
import { seedRepository } from "../repositories/seed";
import { AppError } from "../middleware/errorHandler";

const DEPARTMENTS = ["Engineering", "Product", "Design", "Analytics", "Finance", "HR", "Marketing", "Operations"];
const ROLES = ["Junior Engineer", "Engineer", "Senior Engineer", "Tech Lead", "Manager", "Senior Manager", "Director", "VP", "Analyst", "Designer"];
const COUNTRIES = ["India", "USA", "UK", "Germany", "France", "Japan", "Brazil", "Canada", "Australia", "Singapore"];

const SALARY_RANGE: Record<string, [number, number]> = {
  "Junior Engineer": [400000, 800000],
  "Engineer":        [800000, 1800000],
  "Senior Engineer": [1500000, 2800000],
  "Tech Lead":       [2500000, 4000000],
  "Manager":         [3000000, 5000000],
  "Senior Manager":  [4000000, 7000000],
  "Director":        [6000000, 10000000],
  "VP":              [8000000, 15000000],
  "Analyst":         [500000, 1200000],
  "Designer":        [600000, 1500000],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEmail(firstName: string, lastName: string, used: Set<string>): string {
  const f = firstName.toLowerCase();
  const l = lastName.toLowerCase();

  const candidates = [
    `${f}.${l}@incubyte.com`,
    `${f}.${l[0]}@incubyte.com`,
    `${f[0]}.${l}@incubyte.com`,
  ];

  for (const email of candidates) {
    if (!used.has(email)) {
      used.add(email);
      return email;
    }
  }

  // All three patterns taken — append incrementing counter
  let n = 1;
  while (true) {
    const email = `${f[0]}.${l[0]}.${n}@incubyte.com`;
    if (!used.has(email)) {
      used.add(email);
      return email;
    }
    n++;
  }
}

const BATCH_SIZE = 500;

export const seedService = {
  async seedEmployees(count: number): Promise<{ inserted: number }> {
    const [firstNames, lastNames] = await Promise.all([
      namesRepository.findAllByType("FIRST"),
      namesRepository.findAllByType("LAST"),
    ]);

    if (firstNames.length === 0 || lastNames.length === 0) {
      throw new AppError(422, "Name bank is empty. Upload first_names.txt and last_names.txt first.");
    }

    const usedEmails = await seedRepository.loadExistingEmails();

    let inserted = 0;

    while (inserted < count) {
      const batchSize = Math.min(BATCH_SIZE, count - inserted);

      const batch = Array.from({ length: batchSize }, () => {
        const firstName = pick(firstNames);
        const lastName  = pick(lastNames);
        const role      = pick(ROLES);
        const [min, max] = SALARY_RANGE[role];

        return {
          firstName,
          lastName,
          phone:       `+${randInt(10000000000, 99999999999)}`,
          role,
          department:  pick(DEPARTMENTS),
          country:     pick(COUNTRIES),
          salary:      randInt(min, max),
          email:       generateEmail(firstName, lastName, usedEmails),
          joiningDate: new Date(randInt(2015, 2024), randInt(0, 11), randInt(1, 28)),
        };
      });

      await seedRepository.bulkInsert(batch);
      inserted += batchSize;
    }

    return { inserted: count };
  },
};
