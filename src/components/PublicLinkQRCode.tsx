import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PublicLinkQRCodeProps {
  url: string;
  bankName?: string;
}

const PublicLinkQRCode = ({ url, bankName }: PublicLinkQRCodeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const getCanvas = () => containerRef.current?.querySelector("canvas") as HTMLCanvasElement | null;

  const handleDownload = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qrcode-atualizar-email${bankName ? `-${bankName.replace(/\s+/g, "-").toLowerCase()}` : ""}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast({ title: "QR Code baixado" });
  };

  const handlePrint = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code — Atualizar e-mail</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 40px 20px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #f5f5f5;
            }
            .card {
              background: #fff;
              border-radius: 24px;
              padding: 48px;
              max-width: 500px;
              width: 100%;
              text-align: center;
              box-shadow: 0 4px 24px rgba(0,0,0,0.08);
              border: 2px dashed #e5e7eb;
            }
            h1 { font-size: 28px; margin: 0 0 8px; color: #111827; letter-spacing: -0.02em; }
            p.subtitle { font-size: 15px; color: #6b7280; margin: 0 0 32px; line-height: 1.5; }
            .qr-wrap {
              display: inline-block;
              padding: 20px;
              background: #fff;
              border-radius: 16px;
              border: 1px solid #e5e7eb;
            }
            img { display: block; width: 280px; height: 280px; }
            .steps { margin-top: 32px; text-align: left; font-size: 14px; color: #374151; }
            .steps strong { color: #111827; }
            .steps ol { padding-left: 20px; margin: 8px 0 0; }
            .steps li { margin-bottom: 6px; }
            .footer { margin-top: 24px; font-size: 12px; color: #9ca3af; }
            @media print {
              body { background: #fff; padding: 0; }
              .card { box-shadow: none; border: 2px dashed #d1d5db; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>📧 Atualize seu e-mail</h1>
            <p class="subtitle">Escaneie o QR Code com a câmera do seu celular para cadastrar ou atualizar seu e-mail no sistema de ponto.</p>
            <div class="qr-wrap">
              <img src="${dataUrl}" alt="QR Code" />
            </div>
            <div class="steps">
              <strong>Como usar:</strong>
              <ol>
                <li>Abra a câmera do celular</li>
                <li>Aponte para o QR Code acima</li>
                <li>Toque no link que aparecer</li>
                <li>Informe seu número de folha e novo e-mail</li>
              </ol>
            </div>
            ${bankName ? `<div class="footer">${bankName}</div>` : ""}
          </div>
          <script>
            window.onload = () => { setTimeout(() => window.print(), 300); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  if (!url) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-gradient-to-br from-card to-muted/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            QR Code para impressão
          </span>
        </div>
        <div className="flex gap-1">
          <Button onClick={handleDownload} variant="outline" size="sm">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Baixar
          </Button>
          <Button onClick={handlePrint} variant="default" size="sm">
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div
          ref={containerRef}
          className="rounded-xl border-2 border-dashed border-border bg-white p-3 shadow-sm"
        >
          <QRCodeCanvas
            value={url}
            size={180}
            level="H"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#0f172a"
          />
        </div>
        <div className="flex-1 space-y-2 text-sm">
          <p className="font-semibold text-foreground">Pronto para colar na parede</p>
          <p className="text-muted-foreground">
            Os funcionários escaneiam o QR Code com a câmera do celular e são levados direto à página
            para cadastrar o e-mail.
          </p>
          <p className="text-xs text-muted-foreground">
            Use <strong className="text-foreground">Imprimir</strong> para gerar um cartaz pronto com
            instruções, ou <strong className="text-foreground">Baixar</strong> para usar a imagem em outro lugar.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicLinkQRCode;
