const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface Employee {
  id:          number;
  firstName:   string;
  lastName:    string;
  phone:       string;
  email:       string;
  role:        string;
  department:  string;
  country:     string;
  salary:      number;
  joiningDate: string;
  createdAt:   string;
  updatedAt:   string;
}

// Main insights data — KPIs + salary/headcount charts.
export interface InsightsData {
  currency: string;
  kpi: {
    totalEmployees: number;
    avgSalary:      number;
    maxSalary: { value: number; role: string; department: string } | null;
    minSalary: { value: number; role: string; department: string } | null;
  };
  avgSalaryByDepartment: { department: string; avg: number }[];
  headcountByCountry:    { country: string; count: number; pct: number }[];
  headcountByDepartment: { department: string; count: number; pct: number }[];
}

// Hiring trend — fetched independently so the period toggle is isolated.
export type HiringTrendData = { label: string; count: number }[];

export interface EmployeeListParams {
  page?:       number;
  limit?:      number;
  search?:     string;
  country?:    string;
  department?: string;
  role?:       string;
  sortBy?:     string;
  sortOrder?:  string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export const api = {
  names: {
    upload: (file: File, type: "FIRST" | "LAST") => {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      return fetch(`${BASE}/api/names/upload`, { method: "POST", body: form })
        .then((r) => r.json());
    },
    stats: () => request<{ data: { firstNames: number; lastNames: number } }>("/names/stats"),
  },

  seed: {
    run: (count: number) =>
      request<{ data: { inserted: number } }>("/seed", {
        method: "POST",
        body: JSON.stringify({ count }),
      }),
  },

  employees: {
    list: (params: EmployeeListParams) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") qs.set(k, String(v));
      });
      return request<{ data: Employee[]; total: number; page: number; limit: number; totalPages: number }>(
        `/employees?${qs}`
      );
    },

    meta: () =>
      request<{ data: { countries: string[]; departments: string[]; roles: string[] } }>("/employees/meta"),

    create: (data: Omit<Employee, "id" | "createdAt" | "updatedAt">) =>
      request<{ data: Employee }>("/employees", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: number, data: Partial<Omit<Employee, "id" | "createdAt" | "updatedAt">>) =>
      request<{ data: Employee }>(`/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    remove: (id: number) =>
      request<void>(`/employees/${id}`, { method: "DELETE" }),
  },

  insights: {
    get: (country?: string) => {
      const qs = country ? `?country=${encodeURIComponent(country)}` : "";
      return request<{ data: InsightsData }>(`/insights${qs}`);
    },

    getHiringTrend: (
      country?:     string,
      trendBy?:     "week" | "month" | "year",
      year?:        string,   // filter to a specific year  (when trendBy = "month")
      month?:       string,   // filter to a specific month (when trendBy = "week"), format "YYYY-MM"
    ) => {
      const qs = new URLSearchParams();
      if (country) qs.set("country", country);
      if (trendBy) qs.set("trendBy", trendBy);
      if (year)    qs.set("year",    year);
      if (month)   qs.set("month",   month);
      const q = qs.toString();
      return request<{ data: HiringTrendData }>(`/insights/hiring-trend${q ? `?${q}` : ""}`);
    },
  },
};
