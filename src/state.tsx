import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import type { BusinessParameters, Comment, AnalysisModule } from "./engine/types";
import { defaultParameters, cloneParams } from "./engine/defaults";
import { computeFinance, type FinanceResult } from "./engine/finance";
import { analyzeGlobal, type GlobalAnalysis } from "./engine/scoring";
import { uid } from "./lib/format";

interface AppState {
  params: BusinessParameters;
  finance: FinanceResult;
  global: GlobalAnalysis;
  comments: Comment[];
  narrative: string;
  setNarrative: (s: string) => void;
  bpOverrides: Record<string, number>;
  setOverride: (key: string, value: number | null) => void;
  clearOverrides: () => void;
  updateParam: (path: string, value: unknown) => void;
  updateParams: (changes: Record<string, unknown>) => void;
  resetParams: () => void;
  addComment: (module: AnalysisModule, target: string, text: string) => void;
  toggleComment: (id: string) => void;
  removeComment: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

// Applique une valeur sur un chemin pointé (ex: "investment.capex") de façon immuable.
function setByPath(obj: any, path: string, value: unknown): any {
  const keys = path.split(".");
  const clone = structuredClone(obj);
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur[keys[i]];
    if (cur === undefined) return clone;
  }
  const last = keys[keys.length - 1];
  // Conserve le type numérique si la cible d'origine est un nombre
  if (typeof cur[last] === "number" && typeof value === "string") {
    const n = parseFloat(value);
    cur[last] = isNaN(n) ? cur[last] : n;
  } else {
    cur[last] = value;
  }
  return clone;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useState<BusinessParameters>(() =>
    cloneParams(defaultParameters)
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [narrative, setNarrative] = useState<string>(
    "Cette section de synthèse est éditable. Modifiez-la directement ou demandez au LLM de la rédiger/ajuster en fonction de vos commentaires."
  );
  const [bpOverrides, setBpOverrides] = useState<Record<string, number>>({});

  const setOverride = useCallback((key: string, value: number | null) => {
    setBpOverrides((o) => {
      const next = { ...o };
      if (value === null || Number.isNaN(value)) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const clearOverrides = useCallback(() => setBpOverrides({}), []);

  const finance = useMemo(() => computeFinance(params), [params]);
  const global = useMemo(() => analyzeGlobal(params, finance), [params, finance]);

  const updateParam = useCallback((path: string, value: unknown) => {
    setParams((p) => setByPath(p, path, value));
  }, []);

  const updateParams = useCallback((changes: Record<string, unknown>) => {
    setParams((p) => {
      let next = p;
      for (const [path, value] of Object.entries(changes)) {
        next = setByPath(next, path, value);
      }
      return next;
    });
  }, []);

  const resetParams = useCallback(() => setParams(cloneParams(defaultParameters)), []);

  const addComment = useCallback(
    (module: AnalysisModule, target: string, text: string) => {
      setComments((c) => [
        ...c,
        { id: uid(), module, target, text, createdAt: Date.now(), resolved: false },
      ]);
    },
    []
  );

  const toggleComment = useCallback((id: string) => {
    setComments((c) =>
      c.map((x) => (x.id === id ? { ...x, resolved: !x.resolved } : x))
    );
  }, []);

  const removeComment = useCallback((id: string) => {
    setComments((c) => c.filter((x) => x.id !== id));
  }, []);

  const value: AppState = {
    params,
    finance,
    global,
    comments,
    narrative,
    setNarrative,
    bpOverrides,
    setOverride,
    clearOverrides,
    updateParam,
    updateParams,
    resetParams,
    addComment,
    toggleComment,
    removeComment,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp doit être utilisé dans AppProvider");
  return ctx;
}
