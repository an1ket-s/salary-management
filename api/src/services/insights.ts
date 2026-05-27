import { insightsRepository, type TrendBy } from "../repositories/insights.js";
import { cache } from "../lib/cache.js";
import env from "../config/env.js";

const RATES_TTL = 86_400; // 24 h

const COUNTRY_CURRENCY: Record<string, string> = {
  India:     "INR",
  USA:       "USD",
  UK:        "GBP",
  Germany:   "EUR",
  France:    "EUR",
  Japan:     "JPY",
  Brazil:    "BRL",
  Canada:    "CAD",
  Australia: "AUD",
  Singapore: "SGD",
};

type Rates = Record<string, number>;

async function getExchangeRates(): Promise<Rates> {
  const KEY = "exg_rates:INR";
  const hit  = await cache.get<Rates>(KEY);
  if (hit) return hit;

  const res  = await fetch(
    `https://v6.exchangerate-api.com/v6/${env.EXCHANGE_RATE_API_KEY}/latest/INR`,
  );
  const json = (await res.json()) as { conversion_rates: Rates };
  await cache.set(KEY, json.conversion_rates, RATES_TTL);
  return json.conversion_rates;
}

function toINR(salary: number, country: string, rates: Rates): number {
  const code = COUNTRY_CURRENCY[country] ?? "INR";
  if (code === "INR") return salary;
  return salary / (rates[code] ?? 1);
}

export const insightsService = {
  // Main dashboard data — KPIs + salary/headcount charts.
  // Does NOT include hiring trend (served by its own endpoint).
  async getInsights(country?: string) {
    const currency = country ? (COUNTRY_CURRENCY[country] ?? "INR") : "INR";
    const rates    = country ? null : await getExchangeRates();

    const [raw, headcountByCountry] = await Promise.all([
      insightsRepository.getEmployeeSlice(country),
      insightsRepository.getHeadcountByCountry(),
    ]);

    const employees = raw.map((e) => ({
      ...e,
      salary: country ? e.salary : toINR(e.salary, e.country, rates!),
    }));

    const n      = employees.length;
    const sum    = employees.reduce((a, e) => a + e.salary, 0);
    const maxEmp = n ? employees.reduce((a, b) => (b.salary > a.salary ? b : a)) : null;
    const minEmp = n ? employees.reduce((a, b) => (b.salary < a.salary ? b : a)) : null;

    const deptSalaries = new Map<string, number[]>();
    for (const e of employees) {
      const arr = deptSalaries.get(e.department) ?? [];
      arr.push(e.salary);
      deptSalaries.set(e.department, arr);
    }
    const avgSalaryByDepartment = [...deptSalaries.entries()]
      .map(([department, s]) => ({
        department,
        avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
      }))
      .sort((a, b) => a.department.localeCompare(b.department));

    const deptCount = new Map<string, number>();
    for (const e of employees)
      deptCount.set(e.department, (deptCount.get(e.department) ?? 0) + 1);
    const headcountByDepartment = [...deptCount.entries()]
      .map(([department, count]) => ({
        department,
        count,
        pct: Math.round((count / n) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      currency,
      kpi: {
        totalEmployees: n,
        avgSalary:      Math.round(n ? sum / n : 0),
        maxSalary: maxEmp
          ? { value: Math.round(maxEmp.salary), role: maxEmp.role, department: maxEmp.department }
          : null,
        minSalary: minEmp
          ? { value: Math.round(minEmp.salary), role: minEmp.role, department: minEmp.department }
          : null,
      },
      avgSalaryByDepartment,
      headcountByCountry,
      headcountByDepartment,
    };
  },

  // Hiring trend — served separately so drill-down re-fetches only this.
  async getHiringTrend(
    country?:     string,
    trendBy:      TrendBy = "year",
    yearFilter?:  string,
    monthFilter?: string,
  ) {
    return insightsRepository.getHiringTrend(country, trendBy, yearFilter, monthFilter);
  },
};
