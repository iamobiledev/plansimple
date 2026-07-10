export type ApiError = Error & {
  status?: number;
  details?: unknown;
};

export type SessionResponse = {
  accessToken: string;
  tokenType: "Bearer";
};

export type User = {
  id: string;
  email: string;
  name: string | null;
  organizations?: OrganizationSummary[];
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  role?: string;
  createdAt?: string;
};

export type Organization = OrganizationSummary & {
  members?: Array<{
    userId: string;
    email: string;
    name: string | null;
    role: string;
  }>;
};

export type Project = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const API_BASE = "/api";

function readAccessToken() {
  return window.localStorage.getItem("ps_access");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, headers, ...init } = options;
  const token = readAccessToken();
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(json === undefined || isFormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: json === undefined ? init.body : JSON.stringify(json),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed with status ${response.status}`;
    const error = new Error(message) as ApiError;
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload as T;
}
