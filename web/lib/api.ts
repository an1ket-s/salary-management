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
};
