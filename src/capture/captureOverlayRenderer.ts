import type { CaptureOverlayFrameContext } from "./captureTypes";

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = "rgba(9, 13, 18, 0.58)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = Math.max(1, width / 1920);
  ctx.stroke();
  ctx.restore();
}

export function renderCaptureOverlay(
  ctx: CanvasRenderingContext2D,
  frame: CaptureOverlayFrameContext,
): void {
  const width = frame.width;
  const height = frame.height;
  const scale = Math.max(0.75, Math.min(2.25, width / 1920));
  const safe = Math.round(56 * scale);
  const title = frame.pageTitle ?? frame.title ?? frame.projectName ?? "GeoSee";
  const subtitle = frame.subtitle ?? frame.pageLabel ?? null;
  const brandLabel = frame.brandLabel ?? "GeoVox / GeoSee";

  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  if (frame.mode === "scene-annotations" || frame.mode === "presentation-ui") {
    const titleWidth = Math.min(width - safe * 2, Math.round(720 * scale));
    const titleHeight = subtitle ? Math.round(112 * scale) : Math.round(78 * scale);
    drawPanel(ctx, safe, safe, titleWidth, titleHeight, Math.round(10 * scale));

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = `600 ${Math.round(30 * scale)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(title, safe + 22 * scale, safe + 18 * scale, titleWidth - 44 * scale);

    if (subtitle) {
      ctx.fillStyle = "rgba(225, 232, 236, 0.74)";
      ctx.font = `500 ${Math.round(16 * scale)}px Inter, ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(
        subtitle,
        safe + 22 * scale,
        safe + 62 * scale,
        titleWidth - 44 * scale,
      );
    }
  }

  if (frame.mode === "presentation-ui") {
    const markWidth = Math.round(230 * scale);
    const markHeight = Math.round(42 * scale);
    const markX = width - safe - markWidth;
    drawPanel(ctx, markX, safe, markWidth, markHeight, Math.round(10 * scale));
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `700 ${Math.round(15 * scale)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(brandLabel, markX + 16 * scale, safe + 12 * scale, markWidth - 32 * scale);
  }

  const legendItems = frame.legendItems?.filter((item) => item.label) ?? [];
  if (legendItems.length > 0) {
    const itemHeight = Math.round(24 * scale);
    const panelWidth = Math.round(280 * scale);
    const panelHeight = Math.round(28 * scale + itemHeight * legendItems.length);
    const panelX = safe;
    const panelY = height - safe - panelHeight;
    drawPanel(ctx, panelX, panelY, panelWidth, panelHeight, Math.round(10 * scale));
    ctx.font = `600 ${Math.round(13 * scale)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.fillText("Legend", panelX + 16 * scale, panelY + 10 * scale);
    ctx.font = `500 ${Math.round(13 * scale)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    legendItems.slice(0, 6).forEach((item, index) => {
      const y = panelY + 32 * scale + itemHeight * index;
      ctx.fillStyle = item.color ?? "rgba(255, 255, 255, 0.76)";
      ctx.beginPath();
      ctx.arc(panelX + 20 * scale, y + 7 * scale, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(244, 247, 248, 0.82)";
      const label = item.value ? `${item.label} ${item.value}` : item.label;
      ctx.fillText(label, panelX + 34 * scale, y, panelWidth - 50 * scale);
    });
  }

  ctx.restore();
}
