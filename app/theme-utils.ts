export type ThemeMode = "auto" | "custom";
export type ThemeSettings = {
  mode: ThemeMode;
  primary: string;
  canvas: string;
  surface: string;
  text: string;
  accent: string;
};

export const DEFAULT_THEME: ThemeSettings = {
  mode: "auto",
  primary: "#667461",
  canvas: "#f6f1e7",
  surface: "#fffdf8",
  text: "#25251f",
  accent: "#b67847",
};

const normalize = (color: string) => /^#[0-9a-f]{6}$/i.test(color) ? color : "#667461";
const mix = (first: string, second: string, weight: number) => {
  const a = normalize(first).slice(1).match(/.{2}/g)!.map((value) => parseInt(value, 16));
  const b = normalize(second).slice(1).match(/.{2}/g)!.map((value) => parseInt(value, 16));
  return `#${a.map((value, index) => Math.round(value * (1 - weight) + b[index] * weight).toString(16).padStart(2, "0")).join("")}`;
};

export const resolvedTheme = (settings: ThemeSettings) => {
  const primary = normalize(settings.primary);
  if (settings.mode === "custom") {
    return {
      cream: normalize(settings.canvas), paper: normalize(settings.surface), ink: normalize(settings.text),
      muted: mix(settings.text, settings.canvas, .48), line: mix(settings.canvas, settings.text, .16),
      lineStrong: mix(settings.canvas, settings.text, .36), sage: primary,
      sageSoft: mix(primary, settings.surface, .84), warm: normalize(settings.accent),
    };
  }
  return {
    cream: mix(primary, "#ffffff", .91), paper: mix(primary, "#ffffff", .975), ink: mix(primary, "#000000", .72),
    muted: mix(primary, "#555555", .62), line: mix(primary, "#ffffff", .72),
    lineStrong: mix(primary, "#ffffff", .48), sage: primary, sageSoft: mix(primary, "#ffffff", .84), warm: mix(primary, "#000000", .16),
  };
};

export const applyTheme = (settings: ThemeSettings) => {
  if (typeof document === "undefined") return;
  const theme = resolvedTheme(settings);
  const root = document.documentElement;
  Object.entries(theme).forEach(([name, value]) => root.style.setProperty(`--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value));
};
