export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

let apiToken: string | null = null;

export function setApiToken(token: string | null) {
  apiToken = token;
}

export function getApiToken() {
  return apiToken;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      ...options.headers,
    },
  });

  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = text && isJson ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(
      data?.message ?? (text || `Erro na API (${res.status})`),
      res.status
    );
  }

  return data as T;
}
