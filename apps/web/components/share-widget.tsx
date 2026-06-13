"use client";

import * as React from "react";

import { useCookieState } from "@/hooks/use-cookie-state";
import { AppError } from "@/lib/action-handler";
import { type NormalizedChartPoint } from "@/lib/utils";
import { Button, cn } from "@stellartools/shared-ui";
import { saveAs } from "file-saver";
import { Check, Copy, Download } from "lucide-react";

export interface ShareWidgetProps {
  title: string;
  value: string | number;
  subtitle: string;
  sparkData: NormalizedChartPoint[];
}

type ThemeId = "dark" | "midnight" | "light";

interface ThemeConfig {
  id: ThemeId;
  label: string;
  outerBg: [string, string];
  frameFill: [string, string];
  cardBg: string;
  titleColor: string;
  valueColor: string;
  subtitleColor: string;
  lineColor: string;
  areaColor: string;
  logoColor: string;
  swatchStyle: React.CSSProperties;
}

const THEMES: ThemeConfig[] = [
  {
    id: "dark",
    label: "Dark",
    outerBg: ["#080808", "#111111"],
    frameFill: ["#3a3a3a", "#1a1a1a"],
    cardBg: "#0f0f0f",
    titleColor: "#71717a",
    valueColor: "#fafafa",
    subtitleColor: "#52525b",
    lineColor: "#6366f1",
    areaColor: "#6366f138",
    logoColor: "#e4e4e7",
    swatchStyle: {
      background: "radial-gradient(circle at 35% 35%, #6b7280, #111827)",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    outerBg: ["#0c0a1e", "#1a1535"],
    frameFill: ["#4c3b8a", "#1e1b4b"],
    cardBg: "#100e24",
    titleColor: "#a5b4fc",
    valueColor: "#f0f0ff",
    subtitleColor: "#6d28d9",
    lineColor: "#818cf8",
    areaColor: "#818cf838",
    logoColor: "#c4b5fd",
    swatchStyle: {
      background: "radial-gradient(circle at 35% 35%, #818cf8, #312e81)",
    },
  },
  {
    id: "light",
    label: "Light",
    outerBg: ["#f0f0f4", "#e4e4ec"],
    frameFill: ["#d4d4d8", "#a1a1aa"],
    cardBg: "#ffffff",
    titleColor: "#71717a",
    valueColor: "#09090b",
    subtitleColor: "#a1a1aa",
    lineColor: "#6366f1",
    areaColor: "#6366f128",
    logoColor: "#a1a1aa",
    swatchStyle: {
      background: "radial-gradient(circle at 35% 35%, #e5e7eb, #9ca3af)",
    },
  },
];

const W = 640;
const H = 460;
const PREVIEW_MAX_W = 560;

const DM_SANS_FAMILY = "DM Sans";
const STELLAR_TOOLS_LOGO_VIEWBOX = { width: 423, height: 367 };
const STELLAR_TOOLS_LOGO_PATHS = [
  "M211.019 0C235.091 0 258.448 4.73015 280.44 14.0644C292.191 19.0466 303.41 25.3083 313.826 32.704L311.601 33.8477L283.003 48.4647C261.165 36.3 236.3 29.8736 211.019 29.8736C210.632 29.8736 210.255 29.8736 209.868 29.8736C190.439 30.019 171.512 33.9059 153.629 41.4179C135.747 48.9299 119.712 59.7376 105.969 73.5306C77.9124 101.689 62.4576 139.123 62.4576 178.941C62.4576 185.426 62.8831 191.978 63.7149 198.414L63.9857 200.469L65.8329 199.529L422.048 17.4085V50.9267L72.6028 229.587L71.4326 230.246L44.6043 243.971L44.5753 243.923L43.3663 244.543L0 266.701V233.183L14.6521 225.69C26.9541 219.4 34.2366 206.401 33.2018 192.57C32.8633 188.062 32.6988 183.478 32.6988 178.941C32.6988 154.786 37.4185 131.349 46.7126 109.288C55.6973 87.9828 68.5505 68.8489 84.9241 52.4194C101.298 35.9899 120.37 23.0886 141.608 14.0741C163.601 4.73015 186.957 0 211.019 0Z",
  "M114.567 252.918C121.762 260.246 126.443 269.541 128.116 279.515L356.196 162.909L358.043 161.969L358.314 164.034C359.155 170.538 359.581 177.138 359.581 183.633C359.581 223.451 344.126 260.885 316.069 289.043C302.317 302.846 286.262 313.654 268.361 321.166C250.459 328.687 231.523 332.565 212.073 332.7C211.725 332.7 211.377 332.7 211.029 332.7C201.599 332.7 192.228 331.799 183.05 330.054L188.978 334.28C197.18 341.24 199.626 352.406 195.622 361.905C200.719 362.341 205.855 362.574 211.029 362.574C235.091 362.574 258.448 357.844 280.45 348.51C301.678 339.495 320.75 326.594 337.134 310.164C353.507 293.735 366.361 274.591 375.345 253.286C384.649 231.225 389.369 207.788 389.369 183.633C389.369 179.087 389.195 174.463 388.846 169.888C387.802 156.056 395.075 143.048 407.396 136.748L422.058 129.255V95.7275L114.567 252.918Z",
  "M61.945 319.605L88.2608 298.494C91.5587 295.848 90.3788 290.749 88.019 288.055L74.7982 272.992C72.922 270.85 68.9567 270.016 66.6936 271.945L41.0936 293.686C40.6003 294.103 39.0336 293.114 38.9465 292.542C37.2347 281.27 40.4166 270.83 47.6024 262.145C60.9972 246.21 84.3632 243.283 101.549 255.176C114.702 264.278 121.153 280.252 117.797 296.022L166.492 330.733L182.402 342.044C187.866 346.687 189.027 354.577 184.8 360.587C181.135 365.792 172.875 368.167 167.005 363.941L104.673 319.101C92.5065 328.629 76.0362 330.267 62.6027 323.25C62.0998 322.988 61.3067 322.329 60.9876 322.028C60.591 321.66 61.3357 320.109 61.945 319.624V319.605ZM180.467 352.629C180.448 349.11 177.585 346.261 174.065 346.28C170.554 346.299 167.711 349.169 167.73 352.697C167.75 356.225 170.612 359.065 174.133 359.046C177.643 359.026 180.487 356.157 180.467 352.629Z",
];

function drawStellarToolsLogo(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: string) {
  const scale = width / STELLAR_TOOLS_LOGO_VIEWBOX.width;
  const height = STELLAR_TOOLS_LOGO_VIEWBOX.height * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  for (const path of STELLAR_TOOLS_LOGO_PATHS) {
    ctx.fill(new Path2D(path));
  }
  ctx.restore();

  return { width, height };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSparkline(
  ctx: CanvasRenderingContext2D,
  data: NormalizedChartPoint[],
  x: number,
  y: number,
  w: number,
  h: number,
  lineColor: string,
  areaColor: string
) {
  if (data.length < 2) {
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }

  const vals = data.map((d) => d.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const range = hi - lo || 1;

  const pts = vals.map((v, i) => ({
    px: x + (i / (vals.length - 1)) * w,
    py: y + (1 - (v - lo) / range) * h * 0.75 + h * 0.12,
  }));

  const areaGrad = ctx.createLinearGradient(0, y, 0, y + h);
  areaGrad.addColorStop(0, areaColor);
  areaGrad.addColorStop(1, "transparent");

  ctx.beginPath();
  ctx.moveTo(pts[0].px, y + h);
  ctx.lineTo(pts[0].px, pts[0].py);
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1].px + pts[i].px) / 2;
    ctx.bezierCurveTo(mx, pts[i - 1].py, mx, pts[i].py, pts[i].px, pts[i].py);
  }
  ctx.lineTo(pts[pts.length - 1].px, y + h);
  ctx.closePath();
  ctx.fillStyle = areaGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(pts[0].px, pts[0].py);
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1].px + pts[i].px) / 2;
    ctx.bezierCurveTo(mx, pts[i - 1].py, mx, pts[i].py, pts[i].px, pts[i].py);
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
}

function renderToCanvas(
  canvas: HTMLCanvasElement,
  theme: ThemeConfig,
  title: string,
  value: string | number,
  subtitle: string,
  sparkData: NormalizedChartPoint[]
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const fontFamily = DM_SANS_FAMILY;

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, theme.outerBg[0]);
  bgGrad.addColorStop(1, theme.outerBg[1]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const FX = 26,
    FY = 26,
    FW = W - 52,
    FH = 330;
  const frameGrad = ctx.createLinearGradient(FX, FY, FX + FW, FY + FH);
  frameGrad.addColorStop(0, theme.frameFill[0]);
  frameGrad.addColorStop(1, theme.frameFill[1]);
  roundedRect(ctx, FX, FY, FW, FH, 22);
  ctx.fillStyle = frameGrad;
  ctx.fill();

  // Inner card
  const CP = 13;
  const CX = FX + CP,
    CY = FY + CP;
  const CW = FW - CP * 2,
    CH = FH - CP * 2;
  roundedRect(ctx, CX, CY, CW, CH, 12);
  ctx.fillStyle = theme.cardBg;
  ctx.fill();

  const pad = 24;
  const contentLeft = CX + pad;
  const contentWidth = CW - pad * 2;

  // Clip content to card shape
  ctx.save();
  roundedRect(ctx, CX, CY, CW, CH, 12);
  ctx.clip();

  // Title (app font: DM Sans)
  ctx.font = `500 11px ${fontFamily}, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = theme.titleColor;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(title.toUpperCase(), contentLeft, CY + 20);

  ctx.font = `700 40px ${fontFamily}, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = theme.valueColor;
  const displayValue = typeof value === "number" ? value.toLocaleString() : String(value);
  let valueText = displayValue;
  while (ctx.measureText(valueText + "…").width > contentWidth && valueText.length > 0) {
    valueText = valueText.slice(0, -1);
  }
  if (valueText.length < displayValue.length) valueText += "…";
  ctx.fillText(valueText, contentLeft, CY + 50);

  // Subtitle dot + text
  const dotCY = CY + 108;
  ctx.beginPath();
  ctx.arc(contentLeft + 4, dotCY + 5, 4, 0, Math.PI * 2);
  ctx.fillStyle = theme.lineColor;
  ctx.fill();

  ctx.font = `400 11px ${fontFamily}, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = theme.subtitleColor;
  ctx.fillText(subtitle, contentLeft + 20, dotCY);

  // Sparkline in the bottom portion of the card (with horizontal padding)
  const sparkTop = CY + CH * 0.5;
  const sparkH = CY + CH - sparkTop;
  drawSparkline(ctx, sparkData, contentLeft, sparkTop, contentWidth, sparkH, theme.lineColor, theme.areaColor);

  ctx.restore();

  // Logo + "StellarTools" below the frame (centered as a group, larger and brighter)
  const logoAreaTop = FY + FH;
  const logoCenterY = logoAreaTop + (H - logoAreaTop) / 2;
  const logoLabel = "StellarTools";
  const logoFontSize = 20;
  ctx.font = `600 ${logoFontSize}px ${fontFamily}, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = theme.logoColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const labelW = ctx.measureText(logoLabel).width;
  const logoSize = 32;
  const logoGap = 10;
  const logoScale = STELLAR_TOOLS_LOGO_VIEWBOX.height / STELLAR_TOOLS_LOGO_VIEWBOX.width;
  const logoW = logoSize;
  const logoH = logoW * logoScale;
  const groupW = logoW + logoGap + labelW;
  let logoTextX = (W - groupW) / 2;
  const logoY = logoCenterY - logoH / 2;
  drawStellarToolsLogo(ctx, logoTextX, logoY, logoW, theme.logoColor);
  logoTextX += logoW + logoGap;
  ctx.fillText(logoLabel, logoTextX, logoCenterY);
  ctx.textAlign = "left";
}

export function ShareWidget({ title, value, subtitle, sparkData }: ShareWidgetProps) {
  const [theme, setTheme] = useCookieState<ThemeId>("share_theme", "dark");
  const [copied, setCopied] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const currentTheme = THEMES.find((t) => t.id === theme)!;

  const redraw = React.useCallback(() => {
    if (canvasRef.current) {
      renderToCanvas(canvasRef.current, currentTheme, title, value, subtitle, sparkData);
    }
  }, [currentTheme, title, value, subtitle, sparkData]);

  React.useEffect(() => {
    // Wait for DM Sans (from Google Fonts in layout) to be available for canvas
    document.fonts.ready.then(redraw);
  }, [redraw]);

  const getBlob = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new AppError("Canvas not ready"));
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new AppError("toBlob failed"))), "image/png");
    });

  const handleDownload = async () => {
    const blob = await getBlob();
    saveAs(blob, `${title.toLowerCase().replace(/\s+/g, "-")}-metric.png`);
  };

  const handleCopy = async () => {
    try {
      const blob = await getBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const canvas = canvasRef.current;
      if (canvas) await navigator.clipboard.writeText(canvas.toDataURL());
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex w-full max-w-full justify-center overflow-hidden rounded-xl">
        <canvas
          ref={canvasRef}
          className="h-auto w-full max-w-full"
          style={{ width: "100%", maxWidth: PREVIEW_MAX_W, aspectRatio: `${W} / ${H}` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              title={t.label}
              className={cn(
                "size-8 rounded-full transition-all",
                theme === t.id
                  ? "ring-primary ring-offset-background ring-2 ring-offset-2"
                  : "opacity-60 hover:opacity-90"
              )}
              style={t.swatchStyle}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="size-3.5" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
