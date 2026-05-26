const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
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
};
