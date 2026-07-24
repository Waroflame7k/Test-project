"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type {
  ActivityLog,
  AppData,
  Case,
  CaseProperty,
  CaseTask,
  CustodyTransfer,
  Customer,
  DocumentRecord,
  Payment,
  Property,
  Profile,
  Submission,
} from "@/types/domain";
import { demoData } from "@/services/demo-data";
import { generateCaseCode } from "@/lib/case-utils";
import { CASE_STATUSES, DEMO_PASSWORD } from "@/lib/constants";
import { normalizeAppData } from "@/lib/data-normalization";
import { buildAppDataMutation, hasAppDataMutationChanges } from "@/lib/app-data-mutation";

const STORAGE_KEY = "bds-data";
let mutationQueue = Promise.resolve();

async function loadData(): Promise<AppData> {
  if (typeof window === "undefined") return demoData;
  try {
    const response = await fetch("/api/app-data", { cache: "no-store" });
    if (response.ok) {
      return normalizeAppData((await response.json()) as AppData);
    }
  } catch {
    // fall through to local storage
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeAppData(JSON.parse(raw) as AppData);
  } catch {
    // ignore parse errors
  }
  return demoData;
}

function saveLocalData(data: AppData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

function persistMutation(previous: AppData, next: AppData) {
  const mutation = buildAppDataMutation(previous, next);
  if (!hasAppDataMutationChanges(mutation)) return;

  mutationQueue = mutationQueue
    .then(async () => {
      const response = await fetch("/api/app-data", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mutation),
      });
      if (!response.ok) throw new Error("Không thể đồng bộ thay đổi dữ liệu.");
    })
    .catch(() => {
      // Keep the local copy available; the next realtime refresh will reconcile server data.
    });
}

interface AppContextValue {
  currentUser: Profile | null;
  data: AppData;
  currentScreen: string;
  screenParams: Record<string, unknown>;
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  login: (email: string, password: string) => Profile;
  logout: () => void;
  updateCase: (caseId: string, updates: Partial<Case>) => void;
  createCase: (input: Omit<Case, "id" | "caseCode" | "createdAt" | "updatedAt">) => Case;
  addCustomer: (customer: Omit<Customer, "id" | "createdAt">) => Customer;
  addProperty: (property: Omit<Property, "id" | "createdAt" | "propertyCode">) => Property;
  attachPropertyToCase: (relation: CaseProperty) => void;
  archiveCase: (caseId: string) => void;
  archiveCases: (caseIds: string[]) => void;
  bulkUpdateCases: (caseIds: string[], updates: Partial<Pick<Case, "status" | "assignedTo" | "priority">>) => void;
  addSubmission: (submission: Omit<Submission, "id" | "createdAt" | "updatedAt">) => void;
  deleteSubmission: (submissionId: string) => void;
  addTask: (task: Omit<CaseTask, "id" | "createdAt">) => void;
  completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  addPayment: (payment: Omit<Payment, "id">) => Payment;
  deletePayment: (paymentId: string) => void;
  addDocument: (doc: Omit<DocumentRecord, "id" | "createdAt">) => void;
  updateDocument: (documentId: string, updates: Partial<DocumentRecord>) => void;
  deleteDocument: (documentId: string) => void;
  addCustodyTransfer: (transfer: Omit<CustodyTransfer, "id">) => void;
  addActivityLog: (log: Omit<ActivityLog, "id" | "createdAt">) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const COMPLETED_STATUS = CASE_STATUSES[10];

function nextPropertyCode(existing: Property[]): string {
  const numbers = existing
    .map((property) => Number(property.propertyCode.replace("BDS-", "")))
    .filter(Number.isFinite);
  return `BDS-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(4, "0")}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(demoData);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string>("dashboard");
  const [screenParams, setScreenParams] = useState<Record<string, unknown>>({});
  const initialized = useRef(false);
  const realtimeRefreshInFlight = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      void (async () => {
        const loaded = await loadData();
        setData(loaded);
        saveLocalData(loaded);
        const savedUserId = typeof window !== "undefined" ? localStorage.getItem("bds-user-id") : null;
        if (savedUserId) {
          const profile = loaded.profiles.find((p) => p.id === savedUserId);
          if (profile) setCurrentUser(profile);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const source = new EventSource("/api/app-data/events");
    const refresh = () => {
      if (realtimeRefreshInFlight.current) return;
      realtimeRefreshInFlight.current = true;
      void loadData()
        .then((remote) => {
          saveLocalData(remote);
          setData((previous) => (JSON.stringify(previous) === JSON.stringify(remote) ? previous : remote));
        })
        .finally(() => {
          realtimeRefreshInFlight.current = false;
        });
    };
    const stopUnavailableStream = () => source.close();

    source.addEventListener("revision", refresh);
    source.addEventListener("unavailable", stopUnavailableStream);
    return () => {
      source.removeEventListener("revision", refresh);
      source.removeEventListener("unavailable", stopUnavailableStream);
      source.close();
    };
  }, []);

  const mutate = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      saveLocalData(next);
      persistMutation(prev, next);
      return next;
    });
  }, []);

  const navigate = useCallback((screen: string, params?: Record<string, unknown>) => {
    setCurrentScreen(screen);
    setScreenParams(params ?? {});
  }, []);

  const login = useCallback(
    (email: string, password: string): Profile => {
      if (password !== DEMO_PASSWORD) throw new Error("Mật khẩu không đúng.");
      const profile = data.profiles.find((p) => p.email === email && p.active);
      if (!profile) throw new Error("Tài khoản không tồn tại hoặc đã bị khóa.");
      setCurrentUser(profile);
      if (typeof window !== "undefined") localStorage.setItem("bds-user-id", profile.id);
      return profile;
    },
    [data.profiles]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    setCurrentScreen("dashboard");
    setScreenParams({});
    if (typeof window !== "undefined") localStorage.removeItem("bds-user-id");
  }, []);

  const updateCase = useCallback(
    (caseId: string, updates: Partial<Case>) => {
      mutate((prev) => ({
        ...prev,
        cases: prev.cases.map((c) =>
          c.id === caseId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ),
      }));
    },
    [mutate]
  );

  const createCase = useCallback(
    (input: Omit<Case, "id" | "caseCode" | "createdAt" | "updatedAt">): Case => {
      const year = new Date().getFullYear();
      const existingCodes = data.cases.map((c) => c.caseCode);
      const caseCode = generateCaseCode(year, existingCodes);
      const now = new Date().toISOString();
      const newCase: Case = {
        ...input,
        id: genId("case"),
        caseCode,
        createdAt: now,
        updatedAt: now,
      };
      mutate((prev) => ({ ...prev, cases: [...prev.cases, newCase] }));
      return newCase;
    },
    [data.cases, mutate]
  );

  const addCustomer = useCallback(
    (customer: Omit<Customer, "id" | "createdAt">): Customer => {
      const newCustomer: Customer = {
        ...customer,
        id: genId("cust"),
        createdAt: new Date().toISOString(),
      };
      mutate((prev) => ({ ...prev, customers: [...prev.customers, newCustomer] }));
      return newCustomer;
    },
    [mutate]
  );

  const addProperty = useCallback(
    (property: Omit<Property, "id" | "createdAt" | "propertyCode">): Property => {
      const newProperty: Property = {
        ...property,
        id: genId("prop"),
        propertyCode: nextPropertyCode(data.properties),
        createdAt: new Date().toISOString(),
      };
      mutate((prev) => ({ ...prev, properties: [...prev.properties, newProperty] }));
      return newProperty;
    },
    [data.properties, mutate]
  );

  const attachPropertyToCase = useCallback(
    (relation: CaseProperty) => {
      mutate((prev) => ({
        ...prev,
        caseProperties: prev.caseProperties.some(
          (item) => item.caseId === relation.caseId && item.propertyId === relation.propertyId
        )
          ? prev.caseProperties
          : [...prev.caseProperties, relation],
      }));
    },
    [mutate]
  );

  const archiveCase = useCallback(
    (caseId: string) => {
      const now = new Date().toISOString();
      mutate((prev) => ({
        ...prev,
        cases: prev.cases.map((caseItem) =>
          caseItem.id === caseId ? { ...caseItem, archivedAt: now, updatedAt: now } : caseItem
        ),
      }));
    },
    [mutate]
  );

  const archiveCases = useCallback(
    (caseIds: string[]) => {
      if (caseIds.length === 0) return;
      const ids = new Set(caseIds);
      const now = new Date().toISOString();
      mutate((prev) => ({
        ...prev,
        cases: prev.cases.map((caseItem) =>
          ids.has(caseItem.id) ? { ...caseItem, archivedAt: now, updatedAt: now } : caseItem
        ),
      }));
    },
    [mutate]
  );

  const bulkUpdateCases = useCallback(
    (caseIds: string[], updates: Partial<Pick<Case, "status" | "assignedTo" | "priority">>) => {
      if (caseIds.length === 0) return;
      const ids = new Set(caseIds);
      const now = new Date().toISOString();
      mutate((prev) => ({
        ...prev,
        cases: prev.cases.map((caseItem) => {
          if (!ids.has(caseItem.id)) return caseItem;
          const nextStatus = updates.status ?? caseItem.status;
          return {
            ...caseItem,
            ...updates,
            completedAt: nextStatus === COMPLETED_STATUS ? caseItem.completedAt ?? now : caseItem.completedAt,
            updatedAt: now,
          };
        }),
      }));
    },
    [mutate]
  );

  const addSubmission = useCallback(
    (submission: Omit<Submission, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newSub: Submission = { ...submission, id: genId("sub"), createdAt: now, updatedAt: now };
      mutate((prev) => ({ ...prev, submissions: [...prev.submissions, newSub] }));
    },
    [mutate]
  );

  const addTask = useCallback(
    (task: Omit<CaseTask, "id" | "createdAt">) => {
      const newTask: CaseTask = { ...task, id: genId("task"), createdAt: new Date().toISOString() };
      mutate((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }));
      // Notify immediately instead of waiting for the debounced data synchronization.
      void fetch("/api/telegram/task-created", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: newTask,
          data: { cases: data.cases, customers: data.customers, profiles: data.profiles },
        }),
      }).catch(() => {
        // A Telegram failure must not interrupt creation of the task.
      });
    },
    [data.cases, data.customers, data.profiles, mutate]
  );

  const deleteSubmission = useCallback(
    (submissionId: string) => mutate((prev) => ({ ...prev, submissions: prev.submissions.filter((submission) => submission.id !== submissionId) })),
    [mutate]
  );

  const completeTask = useCallback(
    (taskId: string) => {
      mutate((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, status: "Hoàn thành" as const, completedAt: new Date().toISOString() } : t
        ),
      }));
    },
    [mutate]
  );

  const deleteTask = useCallback(
    (taskId: string) => mutate((prev) => ({ ...prev, tasks: prev.tasks.filter((task) => task.id !== taskId) })),
    [mutate]
  );

  const addPayment = useCallback(
    (payment: Omit<Payment, "id">): Payment => {
      const newPayment: Payment = { ...payment, id: genId("pay") };
      mutate((prev) => ({ ...prev, payments: [...prev.payments, newPayment] }));
      return newPayment;
    },
    [mutate]
  );

  const deletePayment = useCallback(
    (paymentId: string) => mutate((prev) => ({ ...prev, payments: prev.payments.filter((payment) => payment.id !== paymentId) })),
    [mutate]
  );

  const addDocument = useCallback(
    (doc: Omit<DocumentRecord, "id" | "createdAt">) => {
      const newDoc: DocumentRecord = { ...doc, id: genId("doc"), createdAt: new Date().toISOString() };
      mutate((prev) => ({ ...prev, documents: [...prev.documents, newDoc] }));
    },
    [mutate]
  );

  const updateDocument = useCallback(
    (documentId: string, updates: Partial<DocumentRecord>) => {
      mutate((prev) => ({ ...prev, documents: prev.documents.map((document) => (document.id === documentId ? { ...document, ...updates } : document)) }));
    },
    [mutate]
  );

  const deleteDocument = useCallback(
    (documentId: string) => {
      mutate((prev) => ({
        ...prev,
        documents: prev.documents.filter((document) => document.id !== documentId),
        custodyTransfers: prev.custodyTransfers.filter((transfer) => transfer.documentId !== documentId),
      }));
    },
    [mutate]
  );

  const addCustodyTransfer = useCallback(
    (transfer: Omit<CustodyTransfer, "id">) => {
      const newTransfer: CustodyTransfer = { ...transfer, id: genId("ct") };
      mutate((prev) => ({
        ...prev,
        custodyTransfers: [...prev.custodyTransfers, newTransfer],
        documents: prev.documents.map((document) =>
          document.id === newTransfer.documentId
            ? {
                ...document,
                currentHolderId: newTransfer.transferType === "Bàn giao khách" ? undefined : newTransfer.toUserId,
                returnedDate: newTransfer.transferType === "Bàn giao khách" ? newTransfer.transferredAt.slice(0, 10) : document.returnedDate,
              }
            : document
        ),
      }));
    },
    [mutate]
  );

  const addActivityLog = useCallback(
    (log: Omit<ActivityLog, "id" | "createdAt">) => {
      const newLog: ActivityLog = { ...log, id: genId("log"), createdAt: new Date().toISOString() };
      mutate((prev) => ({ ...prev, activityLogs: [...prev.activityLogs, newLog] }));
    },
    [mutate]
  );

  const value: AppContextValue = {
    currentUser,
    data,
    currentScreen,
    screenParams,
    navigate,
    login,
    logout,
    updateCase,
    createCase,
    addCustomer,
    addProperty,
    attachPropertyToCase,
    archiveCase,
    archiveCases,
    bulkUpdateCases,
    addSubmission,
    deleteSubmission,
    addTask,
    completeTask,
    deleteTask,
    addPayment,
    deletePayment,
    addDocument,
    updateDocument,
    deleteDocument,
    addCustodyTransfer,
    addActivityLog,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useCurrentUser(): Profile {
  const { currentUser } = useApp();
  if (!currentUser) throw new Error("No current user");
  return currentUser;
}

export function useCases() {
  const { data, currentUser } = useApp();
  if (!currentUser) return [];
  if (currentUser.role === "legal_staff") {
    return data.cases.filter((c) => c.assignedTo === currentUser.id && !c.archivedAt);
  }
  return data.cases.filter((c) => !c.archivedAt);
}

export function useCaseById(caseId: string) {
  const { data } = useApp();
  return data.cases.find((c) => c.id === caseId && !c.archivedAt) ?? null;
}
