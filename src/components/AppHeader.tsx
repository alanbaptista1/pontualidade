import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BarChart3, CalendarClock, Clock, FileText, LifeBuoy, LogOut, Mail, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSecullum } from "@/contexts/SecullumContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const CHAMADO_ENDPOINT = "https://n8n.dubrasilnexa.com.br/webhook/e125c92f-35f5-4d39-967f-ed66eac28b8c";
const COD_CLIENTE_FIXO = "21094";

const normalizePhoneDigits = (value: string) => value.replace(/\D/g, "");

const formatPhoneDisplay = (digits: string) => {
  if (!digits.startsWith("55")) {
    digits = `55${digits}`;
  }

  const limited = digits.slice(0, 13);
  const country = limited.slice(0, 2);
  const area = limited.slice(2, 4);
  const first = limited.slice(4, 9);
  const last = limited.slice(9, 13);

  if (!area) return `${country} `;

  let formatted = `${country} ${area}`;
  if (first) {
    formatted += ` ${first}`;
  }
  if (last) {
    formatted += `-${last}`;
  }
  return formatted;
};

const AppHeader = () => {
  const { auth, logout } = useSecullum();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState({
    title: "",
    message: "",
    contactName: "",
    phone: "55 ",
  });

  const handleLogout = async () => {
    logout();
    await signOut();
    navigate("/auth");
  };

  const navItems = [
    { label: "Relatório", path: "/relatorio", icon: FileText },
    { label: "Análises", path: "/analises", icon: BarChart3 },
    { label: "Agendamentos", path: "/agendamentos", icon: CalendarClock },
    { label: "Atualizações", path: "/atualizacoes-email", icon: Mail },
    { label: "Conta", path: "/conta", icon: UserCog },
  ];

  const handlePhoneChange = (value: string) => {
    const digits = normalizePhoneDigits(value);
    const formatted = formatPhoneDisplay(digits);
    setFormValues((prev) => ({ ...prev, phone: formatted }));
  };

  const handleSubmitChamado = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      cod_cliente: COD_CLIENTE_FIXO,
      title: formValues.title.trim(),
      message: formValues.message.trim(),
      nome_de_contato: formValues.contactName.trim(),
      telefone: normalizePhoneDigits(formValues.phone),
    };

    const telefoneLength = payload.telefone.length;
    const telefoneValido =
      payload.telefone.startsWith("55") && (telefoneLength === 12 || telefoneLength === 13);

    if (!payload.title || !payload.message || !payload.nome_de_contato || !telefoneValido) {
      toast({
        title: "Preencha todos os campos",
        description: "Informe o telefone completo com DDD.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(CHAMADO_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      toast({
        title: "Chamado enviado",
        description: "Recebemos sua solicitação e vamos retornar em breve.",
      });

      setFormValues({ title: "", message: "", contactName: "", phone: "55 " });
      setIsDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao enviar o chamado.";
      toast({ title: "Falha ao enviar", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

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

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <LifeBuoy className="h-4 w-4" />
                  <span className="hidden sm:inline">Abrir chamado</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>Abertura de chamado</DialogTitle>
                  <DialogDescription>Preencha os dados abaixo para registrar sua solicitação.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitChamado} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="chamado-title">Título da solicitação</Label>
                    <Input
                      id="chamado-title"
                      value={formValues.title}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Ex: Falha no equipamento"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chamado-message">Mensagem de abertura do chamado</Label>
                    <Textarea
                      id="chamado-message"
                      value={formValues.message}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, message: event.target.value }))}
                      placeholder="Descreva o problema com detalhes"
                      className="min-h-[120px]"
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="chamado-contact">Nome do contato</Label>
                      <Input
                        id="chamado-contact"
                        value={formValues.contactName}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, contactName: event.target.value }))}
                        placeholder="Ex: Alan"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chamado-phone">Telefone para contato</Label>
                      <Input
                        id="chamado-phone"
                        value={formValues.phone}
                        onChange={(event) => handlePhoneChange(event.target.value)}
                        inputMode="tel"
                        placeholder="55 34 98888-8888"
                        required
                      />
                    </div>
                  </div>

                  <DialogFooter className="gap-2 sm:justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Enviando..." : "Enviar chamado"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;

