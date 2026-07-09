import { create } from "zustand";
import { api } from "./api";
import type {
  Condition,
  Measurement,
  MeasurementSource,
  Point,
  Project,
  ProjectDetail,
  Sheet,
  Tool,
  User,
} from "./types";
import { pixelQuantity } from "./lib/geometry";
import { toRealQuantity } from "./lib/scale";

/**
 * Undo/redo uses a command stack. Recreating a deleted measurement gives it
 * a new server id, so commands reference measurements by their original id
 * and `idAliases` maps original ids to whatever the current server id is.
 */
type UndoCommand =
  | { kind: "add"; id: string; data: MeasurementData }
  | { kind: "delete"; id: string; data: MeasurementData }
  | { kind: "update"; id: string; before: MeasurementPatch; after: MeasurementPatch };

interface MeasurementData {
  sheetId: string;
  conditionId: string;
  geometry: { points: Point[] };
  computedValue: number;
  source: MeasurementSource;
}

interface MeasurementPatch {
  geometry: { points: Point[] };
  computedValue: number;
}

const idAliases = new Map<string, string>();
function resolveId(id: string): string {
  let current = id;
  while (idAliases.has(current)) current = idAliases.get(current)!;
  return current;
}

let tempCounter = 0;

export interface AiCountCandidate {
  point: Point;
  status: "pending" | "accepted" | "rejected";
}

interface AppState {
  user: User | null;
  authChecked: boolean;
  projects: Project[];
  project: ProjectDetail | null;
  measurements: Measurement[];
  activeSheetId: string | null;
  activeConditionId: string | null;
  tool: Tool;
  selectedMeasurementId: string | null;
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
  toast: string | null;
  aiBusy: boolean;
  aiCountCandidates: AiCountCandidate[] | null;
  aiAreaCandidate: Point[] | null;

  // auth
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  // projects
  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  closeProject: () => void;

  // sheets
  uploadPdf: (file: File) => Promise<void>;
  setActiveSheet: (id: string) => void;
  deleteSheet: (id: string) => Promise<void>;
  calibrateSheet: (sheetId: string, pixelsPerUnit: number, unitSystem: Sheet["unitSystem"]) => Promise<void>;

  // conditions
  createCondition: (data: Omit<Condition, "id" | "projectId">) => Promise<void>;
  updateCondition: (id: string, data: Partial<Omit<Condition, "id" | "projectId">>) => Promise<void>;
  deleteCondition: (id: string) => Promise<void>;
  setActiveCondition: (id: string | null) => void;

  // tools & selection
  setTool: (tool: Tool) => void;
  setSelectedMeasurement: (id: string | null) => void;

  // measurements
  addMeasurement: (data: MeasurementData) => Promise<void>;
  updateMeasurementGeometry: (id: string, points: Point[]) => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // ai
  setAiBusy: (busy: boolean) => void;
  setAiCountCandidates: (points: Point[] | null) => void;
  setAiCandidateStatus: (index: number, status: AiCountCandidate["status"]) => void;
  commitAiCount: () => Promise<void>;
  setAiAreaCandidate: (points: Point[] | null) => void;
  acceptAiArea: () => Promise<void>;

  showToast: (message: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<AppState>((set, get) => {
  function conditionById(id: string): Condition | undefined {
    return get().project?.conditions.find((c) => c.id === id);
  }

  function sheetById(id: string): Sheet | undefined {
    return get().project?.sheets.find((s) => s.id === id);
  }

  /** Insert optimistically, persist, then swap the temp id for the real one. */
  async function persistNewMeasurement(data: MeasurementData, tempId: string): Promise<void> {
    set((s) => ({
      measurements: [...s.measurements, { id: tempId, ...data }],
    }));
    try {
      const saved = await api.createMeasurement(data);
      idAliases.set(tempId, saved.id);
      set((s) => ({
        measurements: s.measurements.map((m) => (m.id === tempId ? saved : m)),
        selectedMeasurementId:
          s.selectedMeasurementId === tempId ? saved.id : s.selectedMeasurementId,
      }));
    } catch (err) {
      set((s) => ({ measurements: s.measurements.filter((m) => m.id !== tempId) }));
      get().showToast(err instanceof Error ? err.message : "Failed to save measurement");
      throw err;
    }
  }

  async function removeMeasurement(id: string): Promise<void> {
    const current = resolveId(id);
    set((s) => ({
      measurements: s.measurements.filter((m) => m.id !== current),
      selectedMeasurementId: s.selectedMeasurementId === current ? null : s.selectedMeasurementId,
    }));
    try {
      await api.deleteMeasurement(current);
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Failed to delete measurement");
    }
  }

  async function applyPatch(id: string, patch: MeasurementPatch): Promise<void> {
    const current = resolveId(id);
    set((s) => ({
      measurements: s.measurements.map((m) => (m.id === current ? { ...m, ...patch } : m)),
    }));
    try {
      await api.updateMeasurement(current, patch);
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Failed to update measurement");
    }
  }

  return {
    user: null,
    authChecked: false,
    projects: [],
    project: null,
    measurements: [],
    activeSheetId: null,
    activeConditionId: null,
    tool: "select",
    selectedMeasurementId: null,
    undoStack: [],
    redoStack: [],
    toast: null,
    aiBusy: false,
    aiCountCandidates: null,
    aiAreaCandidate: null,

    checkAuth: async () => {
      try {
        const { user } = await api.me();
        set({ user, authChecked: true });
        if (user) await get().loadProjects();
      } catch {
        set({ authChecked: true });
      }
    },

    login: async (email, password) => {
      const user = await api.login(email, password);
      set({ user });
      await get().loadProjects();
    },

    register: async (email, password) => {
      const user = await api.register(email, password);
      set({ user });
      await get().loadProjects();
    },

    logout: async () => {
      await api.logout().catch(() => {});
      set({
        user: null,
        projects: [],
        project: null,
        measurements: [],
        activeSheetId: null,
        activeConditionId: null,
        undoStack: [],
        redoStack: [],
      });
    },

    loadProjects: async () => {
      set({ projects: await api.listProjects() });
    },

    createProject: async (name) => {
      await api.createProject(name);
      await get().loadProjects();
    },

    deleteProject: async (id) => {
      await api.deleteProject(id);
      await get().loadProjects();
    },

    openProject: async (id) => {
      const [project, measurements] = await Promise.all([
        api.getProject(id),
        api.listProjectMeasurements(id),
      ]);
      set({
        project,
        measurements,
        activeSheetId: project.sheets[0]?.id ?? null,
        activeConditionId: project.conditions[0]?.id ?? null,
        tool: "select",
        selectedMeasurementId: null,
        undoStack: [],
        redoStack: [],
        aiCountCandidates: null,
        aiAreaCandidate: null,
      });
    },

    closeProject: () => {
      set({
        project: null,
        measurements: [],
        activeSheetId: null,
        activeConditionId: null,
        undoStack: [],
        redoStack: [],
        aiCountCandidates: null,
        aiAreaCandidate: null,
      });
      void get().loadProjects();
    },

    uploadPdf: async (file) => {
      const project = get().project;
      if (!project) return;
      const sheets = await api.uploadPdf(project.id, file);
      set((s) => ({
        project: s.project ? { ...s.project, sheets: [...s.project.sheets, ...sheets] } : s.project,
        activeSheetId: s.activeSheetId ?? sheets[0]?.id ?? null,
      }));
      get().showToast(`Added ${sheets.length} sheet${sheets.length === 1 ? "" : "s"}`);
    },

    setActiveSheet: (id) => {
      set({
        activeSheetId: id,
        selectedMeasurementId: null,
        aiCountCandidates: null,
        aiAreaCandidate: null,
      });
    },

    deleteSheet: async (id) => {
      await api.deleteSheet(id);
      set((s) => {
        const sheets = s.project?.sheets.filter((sh) => sh.id !== id) ?? [];
        return {
          project: s.project ? { ...s.project, sheets } : s.project,
          measurements: s.measurements.filter((m) => m.sheetId !== id),
          activeSheetId: s.activeSheetId === id ? (sheets[0]?.id ?? null) : s.activeSheetId,
        };
      });
    },

    calibrateSheet: async (sheetId, pixelsPerUnit, unitSystem) => {
      const updated = await api.updateSheet(sheetId, { scalePixelsPerUnit: pixelsPerUnit, unitSystem });
      set((s) => ({
        project: s.project
          ? { ...s.project, sheets: s.project.sheets.map((sh) => (sh.id === sheetId ? updated : sh)) }
          : s.project,
      }));

      // Recompute stored quantities for this sheet under the new scale.
      const affected = get().measurements.filter((m) => m.sheetId === sheetId);
      for (const m of affected) {
        const condition = conditionById(m.conditionId);
        if (!condition || condition.measurementType === "count") continue;
        const px = pixelQuantity(condition.measurementType, m.geometry.points);
        const value = toRealQuantity(condition.measurementType, px, pixelsPerUnit);
        set((s) => ({
          measurements: s.measurements.map((mm) =>
            mm.id === m.id ? { ...mm, computedValue: value } : mm
          ),
        }));
        api.updateMeasurement(resolveId(m.id), { computedValue: value }).catch(() => {
          get().showToast("Failed to update a measurement after recalibration");
        });
      }
      get().showToast("Scale saved");
    },

    createCondition: async (data) => {
      const project = get().project;
      if (!project) return;
      const condition = await api.createCondition(project.id, data);
      set((s) => ({
        project: s.project
          ? { ...s.project, conditions: [...s.project.conditions, condition] }
          : s.project,
        activeConditionId: condition.id,
      }));
    },

    updateCondition: async (id, data) => {
      const updated = await api.updateCondition(id, data);
      set((s) => ({
        project: s.project
          ? {
              ...s.project,
              conditions: s.project.conditions.map((c) => (c.id === id ? updated : c)),
            }
          : s.project,
      }));
    },

    deleteCondition: async (id) => {
      await api.deleteCondition(id);
      set((s) => ({
        project: s.project
          ? { ...s.project, conditions: s.project.conditions.filter((c) => c.id !== id) }
          : s.project,
        measurements: s.measurements.filter((m) => m.conditionId !== id),
        activeConditionId:
          s.activeConditionId === id
            ? (s.project?.conditions.find((c) => c.id !== id)?.id ?? null)
            : s.activeConditionId,
      }));
    },

    setActiveCondition: (id) => set({ activeConditionId: id }),

    setTool: (tool) => {
      set({ tool, selectedMeasurementId: null });
    },

    setSelectedMeasurement: (id) => set({ selectedMeasurementId: id }),

    addMeasurement: async (data) => {
      const tempId = `temp-${++tempCounter}`;
      set((s) => ({
        undoStack: [...s.undoStack, { kind: "add", id: tempId, data }],
        redoStack: [],
      }));
      await persistNewMeasurement(data, tempId);
    },

    updateMeasurementGeometry: async (id, points) => {
      const m = get().measurements.find((mm) => mm.id === id);
      if (!m) return;
      const condition = conditionById(m.conditionId);
      const sheet = sheetById(m.sheetId);
      if (!condition || !sheet) return;
      const px = pixelQuantity(condition.measurementType, points);
      const computedValue =
        condition.measurementType === "count"
          ? px
          : toRealQuantity(condition.measurementType, px, sheet.scalePixelsPerUnit);
      const before: MeasurementPatch = {
        geometry: m.geometry,
        computedValue: m.computedValue,
      };
      const after: MeasurementPatch = { geometry: { points }, computedValue };
      set((s) => ({
        undoStack: [...s.undoStack, { kind: "update", id, before, after }],
        redoStack: [],
      }));
      await applyPatch(id, after);
    },

    deleteMeasurement: async (id) => {
      const m = get().measurements.find((mm) => mm.id === id);
      if (!m) return;
      set((s) => ({
        undoStack: [
          ...s.undoStack,
          {
            kind: "delete",
            id,
            data: {
              sheetId: m.sheetId,
              conditionId: m.conditionId,
              geometry: m.geometry,
              computedValue: m.computedValue,
              source: m.source,
            },
          },
        ],
        redoStack: [],
      }));
      await removeMeasurement(id);
    },

    undo: async () => {
      const { undoStack } = get();
      const cmd = undoStack[undoStack.length - 1];
      if (!cmd) return;
      set((s) => ({
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, cmd],
      }));
      switch (cmd.kind) {
        case "add":
          await removeMeasurement(cmd.id);
          break;
        case "delete": {
          const tempId = `temp-${++tempCounter}`;
          idAliases.set(cmd.id, tempId);
          await persistNewMeasurement(cmd.data, tempId).catch(() => {});
          break;
        }
        case "update":
          await applyPatch(cmd.id, cmd.before);
          break;
      }
    },

    redo: async () => {
      const { redoStack } = get();
      const cmd = redoStack[redoStack.length - 1];
      if (!cmd) return;
      set((s) => ({
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, cmd],
      }));
      switch (cmd.kind) {
        case "add": {
          const tempId = `temp-${++tempCounter}`;
          idAliases.set(cmd.id, tempId);
          await persistNewMeasurement(cmd.data, tempId).catch(() => {});
          break;
        }
        case "delete":
          await removeMeasurement(cmd.id);
          break;
        case "update":
          await applyPatch(cmd.id, cmd.after);
          break;
      }
    },

    setAiBusy: (busy) => set({ aiBusy: busy }),

    setAiCountCandidates: (points) =>
      set({
        aiCountCandidates: points ? points.map((point) => ({ point, status: "pending" as const })) : null,
      }),

    setAiCandidateStatus: (index, status) =>
      set((s) => ({
        aiCountCandidates:
          s.aiCountCandidates?.map((c, i) => (i === index ? { ...c, status } : c)) ?? null,
      })),

    commitAiCount: async () => {
      const { aiCountCandidates, activeSheetId, activeConditionId } = get();
      if (!aiCountCandidates || !activeSheetId || !activeConditionId) return;
      const accepted = aiCountCandidates.filter((c) => c.status !== "rejected");
      set({ aiCountCandidates: null });
      for (const c of accepted) {
        await get()
          .addMeasurement({
            sheetId: activeSheetId,
            conditionId: activeConditionId,
            geometry: { points: [c.point] },
            computedValue: 1,
            source: "ai",
          })
          .catch(() => {});
      }
      if (accepted.length > 0) {
        get().showToast(`Added ${accepted.length} count marker${accepted.length === 1 ? "" : "s"}`);
      }
    },

    setAiAreaCandidate: (points) => set({ aiAreaCandidate: points }),

    acceptAiArea: async () => {
      const { aiAreaCandidate, activeSheetId, activeConditionId } = get();
      if (!aiAreaCandidate || aiAreaCandidate.length < 3 || !activeSheetId || !activeConditionId) return;
      const sheet = sheetById(activeSheetId);
      const condition = conditionById(activeConditionId);
      if (!sheet || !condition) return;
      const px = pixelQuantity("area", aiAreaCandidate);
      let computedValue: number;
      try {
        computedValue = toRealQuantity("area", px, sheet.scalePixelsPerUnit);
      } catch {
        get().showToast("Calibrate the sheet scale before accepting an area");
        return;
      }
      set({ aiAreaCandidate: null });
      await get().addMeasurement({
        sheetId: activeSheetId,
        conditionId: activeConditionId,
        geometry: { points: aiAreaCandidate },
        computedValue,
        source: "ai",
      });
    },

    showToast: (message) => {
      set({ toast: message });
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => set({ toast: null }), 3500);
    },
  };
});
