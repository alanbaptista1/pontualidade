import { useEffect, useRef, useState } from "react";
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
  const [shortUrl, setShortUrl] = useState<string>("");
  const [shortening, setShortening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const shorten = async () => {
      if (!url) {
        setShortUrl("");
        return;
      }
      setShortening(true);
      try {
        const res = await fetch(
          `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
        );
        const text = (await res.text()).trim();
        if (!cancelled && text.startsWith("http")) {
          setShortUrl(text);
        } else if (!cancelled) {
          setShortUrl(url);
        }
      } catch {
        if (!cancelled) setShortUrl(url);
      } finally {
        if (!cancelled) setShortening(false);
      }
    };
    shorten();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const getCanvas = () => containerRef.current?.querySelector("canvas") as HTMLCanvasElement | null;

  const displayUrl = shortUrl || url;

  const handleDownload = () => {
    const canvas = getCanvas();
    if (!canvas) return;

    // Compose a new canvas with QR + short URL text below
    const padding = 24;
    const textHeight = 56;
    const out = document.createElement("canvas");
    out.width = canvas.width + padding * 2;
    out.height = canvas.height + padding * 2 + textHeight;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, padding, padding);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(displayUrl, out.width / 2, canvas.height + padding + 36);

    const link = document.createElement("a");
    link.download = `qrcode-atualizar-email${bankName ? `-${bankName.replace(/\s+/g, "-").toLowerCase()}` : ""}.png`;
    link.href = out.toDataURL("image/png");
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
            .short-url {
              margin-top: 20px;
              padding: 12px 20px;
              background: #f3f4f6;
              border-radius: 12px;
              font-size: 18px;
              font-weight: 700;
              color: #111827;
              letter-spacing: 0.02em;
              word-break: break-all;
            }
            .short-url-label {
              margin-top: 16px;
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .steps { margin-top: 28px; text-align: left; font-size: 14px; color: #374151; }
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
            <div class="short-url-label">ou acesse pelo link</div>
            <div class="short-url">${displayUrl}</div>
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
          <Button onClick={handleDownload} variant="outline" size="sm" disabled={shortening}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Baixar
          </Button>
          <Button onClick={handlePrint} variant="default" size="sm" disabled={shortening}>
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
            Os funcionários escaneiam o QR Code ou digitam o link curto abaixo.
          </p>
          <div className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs">
            {shortening ? "Gerando link curto…" : displayUrl}
          </div>
          <p className="text-xs text-muted-foreground">
            Use <strong className="text-foreground">Imprimir</strong> para o cartaz pronto ou{" "}
            <strong className="text-foreground">Baixar</strong> para a imagem com o link.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicLinkQRCode;
