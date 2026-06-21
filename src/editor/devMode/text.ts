import { TECHNICAL_MONO_FONT } from "../styles";
import {
  FONT_FAMILY_OPTIONS,
  FONT_STYLE_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  TEXT_TRANSFORM_OPTIONS,
} from "./constants";
import { clampNumber, cssNumber } from "./util";

export interface TextDraft {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textTransform: string;
  color: string;
  opacity: number;
}

export function readEditableText(element: HTMLElement): string {
  const directText = Array.from(element.childNodes)
    .filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.nodeValue ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return directText || element.textContent?.replace(/\s+/g, " ").trim() || "";
}

export function writeEditableText(element: HTMLElement, value: string) {
  const directText = Array.from(element.childNodes).find(
    (node): node is Text =>
      node.nodeType === Node.TEXT_NODE && Boolean((node.nodeValue ?? "").trim()),
  );
  if (directText) {
    directText.nodeValue = value;
    return;
  }
  element.textContent = value;
}

export function readTextDraft(element: HTMLElement | null): TextDraft {
  if (!element) {
    return {
      text: "",
      fontSize: 13,
      fontFamily: "inherit",
      fontWeight: "600",
      fontStyle: "normal",
      textTransform: "none",
      color: "#f4f0e8",
      opacity: 1,
    };
  }
  const style = getComputedStyle(element);
  return {
    text: readEditableText(element),
    fontSize: cssNumber(style.fontSize) || 13,
    fontFamily: normalizeFontFamily(style.fontFamily),
    fontWeight: normalizeFontWeight(style.fontWeight),
    fontStyle: normalizeOption(style.fontStyle, FONT_STYLE_OPTIONS, "normal"),
    textTransform: normalizeOption(
      style.textTransform,
      TEXT_TRANSFORM_OPTIONS,
      "none",
    ),
    color: cssColorToHex(style.color),
    opacity: clampNumber(cssNumber(style.opacity) || 1, 0, 1),
  };
}

export function applyTextStyle<K extends keyof TextDraft>(
  element: HTMLElement,
  key: K,
  value: TextDraft[K],
) {
  if (key === "fontSize") {
    element.style.fontSize = `${value}px`;
    return;
  }
  if (key === "fontFamily") {
    element.style.fontFamily = value === "inherit" ? "" : String(value);
    return;
  }
  if (key === "fontWeight") {
    element.style.fontWeight = String(value);
    return;
  }
  if (key === "fontStyle") {
    element.style.fontStyle = String(value);
    return;
  }
  if (key === "textTransform") {
    element.style.textTransform = String(value);
    return;
  }
  if (key === "color") {
    element.style.color = String(value);
    return;
  }
  if (key === "opacity") {
    element.style.opacity = String(value);
  }
}

export function normalizeFontFamily(
  fontFamily: string,
): typeof FONT_FAMILY_OPTIONS[number] {
  const lower = fontFamily.toLowerCase();
  if (lower.includes("georgia")) return "Georgia, serif";
  if (lower.includes("arial")) return "Arial, Helvetica, sans-serif";
  if (lower.includes("consolas")) return "Consolas, monospace";
  if (lower.includes("system")) return "system-ui, sans-serif";
  if (lower.includes("mono")) return TECHNICAL_MONO_FONT;
  return "inherit";
}

export function normalizeFontWeight(
  weight: string,
): typeof FONT_WEIGHT_OPTIONS[number] {
  const numeric = Number.parseInt(weight, 10);
  if (!Number.isFinite(numeric)) return "600";
  if (numeric <= 400) return "400";
  if (numeric <= 500) return "500";
  if (numeric <= 600) return "600";
  if (numeric <= 700) return "700";
  return "800";
}

export function normalizeOption<T extends readonly string[]>(
  value: string,
  options: T,
  fallback: T[number],
): T[number] {
  return options.includes(value) ? value : fallback;
}

export function cssColorToHex(value: string): string {
  const rgb = value.match(/rgba?\(([^)]+)\)/i);
  if (!rgb) return "#f4f0e8";
  const parts = rgb[1]
    .split(",")
    .slice(0, 3)
    .map((part) => clampNumber(Number.parseFloat(part.trim()), 0, 255));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
    return "#f4f0e8";
  }
  return `#${parts
    .map((part) => Math.round(part).toString(16).padStart(2, "0"))
    .join("")}`;
}
