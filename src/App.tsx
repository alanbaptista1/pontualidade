import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SecullumProvider } from "@/contexts/SecullumContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import AccountPage from "./pages/AccountPage";
import LoginPage from "./pages/LoginPage";
import ReportPage from "./pages/ReportPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SchedulesPage from "./pages/SchedulesPage";
import EmailUpdatesPage from "./pages/EmailUpdatesPage";
import EmployeesListPage from "./pages/EmployeesListPage";
import PublicEmailUpdatePage from "./pages/PublicEmailUpdatePage";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "@/components/ThemeProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <SecullumProvider>
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/" element={<ProtectedRoute><LoginPage /></ProtectedRoute>} />
                <Route path="/conta" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                <Route path="/relatorio" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
                <Route path="/analises" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/agendamentos" element={<ProtectedRoute><SchedulesPage /></ProtectedRoute>} />
                <Route path="/atualizacoes-email" element={<ProtectedRoute><EmailUpdatesPage /></ProtectedRoute>} />
                <Route path="/funcionarios" element={<ProtectedRoute><EmployeesListPage /></ProtectedRoute>} />
                <Route path="/publico/atualizar-email/:userId" element={<PublicEmailUpdatePage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SecullumProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
