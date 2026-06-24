import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import type { BusinessParameters, Comment, AnalysisModule } from "./engine/types";
import { defaultParameters, cloneParams } from "./engine/defaults";
import { computeFinance, type FinanceResult } from "./engine/finance";
import { analyzeGlobal, type GlobalAnalysis } from "./engine/scoring";
import { uid } from "./lib/format";
import { setByPath } from "./lib/paths";

export interface Variant {
  id: string;
  name: string;
  params: BusinessParameters;
  savedAt: number;
}

const LS_VARIANTS = "be.variants";

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
  loadParams: (p: BusinessParameters) => void;
  variants: Variant[];
  saveVariant: (name: string) => void;
  deleteVariant: (id: string) => void;
  loadVariant: (id: string) => void;
  addComment: (module: AnalysisModule, target: string, text: string) => void;
  toggleComment: (id: string) => void;
  removeComment: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

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
  const loadParams = useCallback((p: BusinessParameters) => setParams(cloneParams(p)), []);

  // --- Variantes (persistées en localStorage) ---
  const [variants, setVariants] = useState<Variant[]>(() => {
    try {
      const raw = localStorage.getItem(LS_VARIANTS);
      return raw ? (JSON.parse(raw) as Variant[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_VARIANTS, JSON.stringify(variants));
    } catch {
      /* quota / mode privé : on ignore */
    }
  }, [variants]);

  const saveVariant = useCallback(
    (name: string) => {
      setVariants((v) => [
        ...v,
        { id: uid(), name: name.trim() || `Variante ${v.length + 1}`, params: cloneParams(params), savedAt: Date.now() },
      ]);
    },
    [params]
  );

  const deleteVariant = useCallback((id: string) => {
    setVariants((v) => v.filter((x) => x.id !== id));
  }, []);

  const loadVariant = useCallback(
    (id: string) => {
      setVariants((v) => {
        const found = v.find((x) => x.id === id);
        if (found) setParams(cloneParams(found.params));
        return v;
      });
    },
    []
  );

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
    loadParams,
    variants,
    saveVariant,
    deleteVariant,
    loadVariant,
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
