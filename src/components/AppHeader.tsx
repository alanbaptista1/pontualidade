import { useNavigate, useLocation } from "react-router-dom";
import { Clock, LogOut, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSecullum } from "@/contexts/SecullumContext";
import { cn } from "@/lib/utils";

const AppHeader = () => {
  const { auth, logout } = useSecullum();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navItems = [
    { label: "Relatório", path: "/relatorio", icon: FileText },
    { label: "Análises", path: "/analises", icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold text-foreground">Controle de Pontualidade</h1>
              <p className="text-xs text-muted-foreground">{auth?.bankName}</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                onClick={() => navigate(item.path)}
                className={cn(
                  "gap-1.5 text-muted-foreground hover:text-foreground",
                  location.pathname === item.path &&
                    "bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Button>
            ))}
          </nav>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
};

export default AppHeader;
