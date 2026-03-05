import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { AuthState } from "@/types/secullum";

interface SecullumContextType {
  auth: AuthState | null;
  setAuth: (auth: AuthState | null) => void;
  logout: () => void;
}

const SecullumContext = createContext<SecullumContextType | null>(null);

export function SecullumProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const stored = sessionStorage.getItem("secullum_auth");
    return stored ? JSON.parse(stored) : null;
  });

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
  }, [handleSetAuth]);

  return (
    <SecullumContext.Provider value={{ auth, setAuth: handleSetAuth, logout }}>
      {children}
    </SecullumContext.Provider>
  );
}

export function useSecullum() {
  const ctx = useContext(SecullumContext);
  if (!ctx) throw new Error("useSecullum must be inside SecullumProvider");
  return ctx;
}
