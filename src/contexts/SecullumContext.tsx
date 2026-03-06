import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { AuthState, LatenessRecord, SecullumDepartamento } from "@/types/secullum";

interface ReportData {
  records: LatenessRecord[];
  departments: SecullumDepartamento[];
  dataInicio: string;
  dataFim: string;
  hasSearched: boolean;
}

interface SecullumContextType {
  auth: AuthState | null;
  setAuth: (auth: AuthState | null) => void;
  logout: () => void;
  reportData: ReportData;
  setReportData: (data: Partial<ReportData>) => void;
}

const SecullumContext = createContext<SecullumContextType | null>(null);

const defaultReportData: ReportData = {
  records: [],
  departments: [],
  dataInicio: "",
  dataFim: "",
  hasSearched: false,
};

export function SecullumProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const stored = sessionStorage.getItem("secullum_auth");
    return stored ? JSON.parse(stored) : null;
  });

  const [reportData, setReportDataState] = useState<ReportData>(defaultReportData);

  const handleSetAuth = useCallback((newAuth: AuthState | null) => {
    setAuth(newAuth);
    if (newAuth) {
      sessionStorage.setItem("secullum_auth", JSON.stringify(newAuth));
    } else {
      sessionStorage.removeItem("secullum_auth");
    }
  }, []);

  const logout = useCallback(() => {
    handleSetAuth(null);
    setReportDataState(defaultReportData);
  }, [handleSetAuth]);

  const setReportData = useCallback((data: Partial<ReportData>) => {
    setReportDataState((prev) => ({ ...prev, ...data }));
  }, []);

  return (
    <SecullumContext.Provider value={{ auth, setAuth: handleSetAuth, logout, reportData, setReportData }}>
      {children}
    </SecullumContext.Provider>
  );
}

export function useSecullum() {
  const ctx = useContext(SecullumContext);
  if (!ctx) throw new Error("useSecullum must be inside SecullumProvider");
  return ctx;
}
