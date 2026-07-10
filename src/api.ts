import type {
  Condition,
  Icon,
  LibraryItem,
  Measurement,
  MeasurementSource,
  Point,
  Project,
  ProjectDetail,
  Sheet,
  User,
} from "./types";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new ApiError(res.status, message);
  }
  return res.json();
}

export const api = {
  // auth
  me: () => request<{ user: User | null }>("/api/auth/me"),
  login: (email: string, password: string) =>
    request<User>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string) =>
    request<User>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),

  // projects
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (data: { name: string; address?: string | null; clientName?: string | null }) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<Pick<Project, "name" | "address" | "clientName">>) =>
    request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getProject: (id: string) => request<ProjectDetail>(`/api/projects/${id}`),
  deleteProject: (id: string) => request<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),
  listProjectMeasurements: (projectId: string) =>
    request<Measurement[]>(`/api/projects/${projectId}/measurements`),

  // sheets
  uploadPdf: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Sheet[]>(`/api/sheets/upload/${projectId}`, { method: "POST", body: form });
  },
  updateSheet: (id: string, data: Partial<Pick<Sheet, "name" | "scalePixelsPerUnit" | "unitSystem">>) =>
    request<Sheet>(`/api/sheets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSheet: (id: string) => request<{ ok: true }>(`/api/sheets/${id}`, { method: "DELETE" }),

  // conditions
  createCondition: (projectId: string, data: Omit<Condition, "id" | "projectId">) =>
    request<Condition>(`/api/conditions/project/${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCondition: (id: string, data: Partial<Omit<Condition, "id" | "projectId">>) =>
    request<Condition>(`/api/conditions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCondition: (id: string) =>
    request<{ ok: true }>(`/api/conditions/${id}`, { method: "DELETE" }),

  // measurements
  createMeasurement: (data: {
    sheetId: string;
    conditionId: string;
    geometry: { points: Point[] };
    computedValue: number;
    source: MeasurementSource;
  }) => request<Measurement>("/api/measurements", { method: "POST", body: JSON.stringify(data) }),
  updateMeasurement: (
    id: string,
    data: Partial<{ geometry: { points: Point[] }; computedValue: number; conditionId: string }>
  ) => request<Measurement>(`/api/measurements/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMeasurement: (id: string) =>
    request<{ ok: true }>(`/api/measurements/${id}`, { method: "DELETE" }),

  // item library
  listLibrary: () => request<LibraryItem[]>("/api/library"),
  createLibraryItem: (data: Omit<LibraryItem, "id" | "userId">) =>
    request<LibraryItem>("/api/library", { method: "POST", body: JSON.stringify(data) }),
  updateLibraryItem: (id: string, data: Partial<Omit<LibraryItem, "id" | "userId">>) =>
    request<LibraryItem>(`/api/library/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLibraryItem: (id: string) =>
    request<{ ok: true }>(`/api/library/${id}`, { method: "DELETE" }),

  // icons
  listIcons: () => request<Icon[]>("/api/icons"),
  uploadIcon: (file: File, name?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    return request<Icon>("/api/icons", { method: "POST", body: form });
  },
  deleteIcon: (id: string) => request<{ ok: true }>(`/api/icons/${id}`, { method: "DELETE" }),

  // ai
  aiCount: (data: {
    templateImage: string;
    sheetImage: string;
    sheetImageWidth: number;
    sheetImageHeight: number;
    hint?: string;
  }) => request<{ matches: Point[] }>("/api/ai/count", { method: "POST", body: JSON.stringify(data) }),
  aiSuggestArea: (data: {
    regionImage: string;
    regionWidth: number;
    regionHeight: number;
    clickX: number;
    clickY: number;
  }) =>
    request<{ polygon: Point[] }>("/api/ai/suggest-area", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export { ApiError };
