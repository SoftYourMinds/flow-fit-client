import { ThemePreset, CustomThemeConfig } from './theme.types';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Normalizes and converts hex string to RGB object
 */
export function hexToRgb(hex: string): RgbColor {
  let cleanHex = hex.trim().replace(/^#/, '');

  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }

  if (cleanHex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(cleanHex)) {
    return { r: 200, g: 138, b: 114 }; // Default Terracotta fallback
  }

  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16)
  };
}

/**
 * Converts RGB components to hex string format #RRGGBB
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Returns formatted "r, g, b" string for CSS rgba()
 */
export function rgbToString(rgb: RgbColor): string {
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

/**
 * Calculates high-contrast foreground color (white or dark) based on luminance
 */
export function getContrastColor(hex: string): { hex: string; rgb: string } {
  const { r, g, b } = hexToRgb(hex);
  // Perceived luminance formula (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  
  if (luminance > 165) {
    return { hex: '#141211', rgb: '20, 18, 17' };
  } else {
    return { hex: '#FFFFFF', rgb: '255, 255, 255' };
  }
}

/**
 * Darkens a hex color by given percentage (0 to 1)
 */
export function shadeColor(hex: string, factor = 0.12): string {
  const { r, g, b } = hexToRgb(hex);
  const mult = 1 - factor;
  return rgbToHex(r * mult, g * mult, b * mult);
}

/**
 * Lightens a hex color by given percentage (0 to 1)
 */
export function tintColor(hex: string, factor = 0.15): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * factor,
    g + (255 - g) * factor,
    b + (255 - b) * factor
  );
}

/**
 * Linear blend between two colors by weight (0 to 1)
 */
export function blend(hex1: string, hex2: string, weight: number): string {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    c1.r + (c2.r - c1.r) * w,
    c1.g + (c2.g - c1.g) * w,
    c1.b + (c2.b - c1.b) * w
  );
}

/**
 * Converts Hex to HSL
 */
export function hexToHsl(hex: string): HslColor {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / d + 2; break;
      case bNorm: h = (rNorm - gNorm) / d + 4; break;
    }
    h = h * 60;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Converts HSL to Hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = (h % 360 + 360) % 360 / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return rgbToHex(val, val, val);
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  const r = Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hNorm) * 255);
  const b = Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255);

  return rgbToHex(r, g, b);
}

/**
 * Generates an analogous harmonic color from base color
 */
export function getHarmoniousColor(hex: string, hueOffset = 35): string {
  const hsl = hexToHsl(hex);
  const newHue = (hsl.h + hueOffset) % 360;
  return hslToHex(newHue, hsl.s, hsl.l);
}

/**
 * Generates dark mode step colors from background to text
 */
export function generateStepVariables(darkBgHex: string, darkTextHex: string): string {
  const lines: string[] = [];
  for (let i = 50; i <= 950; i += 50) {
    const stepColor = blend(darkBgHex, darkTextHex, i / 1000);
    lines.push(`  --ion-color-step-${i}: ${stepColor};`);
  }
  return lines.join('\n');
}

/**
 * Generates custom theme preset from user config
 */
export function buildCustomPreset(config: CustomThemeConfig): ThemePreset {
  const primary = config.primary || '#8B5CF6';
  const secondary = config.secondary || getHarmoniousColor(primary, 35);
  const tertiary = config.tertiary || tintColor(primary, 0.25);

  let darkBg: string;
  let darkSurface: string;
  let darkText: string;

  switch (config.darkTone) {
    case 'oled':
      darkBg = '#000000';
      darkSurface = '#121212';
      darkText = '#FFFFFF';
      break;
    case 'tinted':
      darkBg = blend('#0D0D11', primary, 0.08);
      darkSurface = blend('#171720', primary, 0.12);
      darkText = '#F3F4F6';
      break;
    case 'charcoal':
    default:
      darkBg = '#121214';
      darkSurface = '#1E1E22';
      darkText = '#F3F4F6';
      break;
  }

  return {
    id: 'custom',
    name: 'Власна тема',
    description: 'Користувацька тема',
    primary,
    secondary,
    tertiary,
    lightBg: '#FAF7F5',
    lightSurface: '#FFFFFF',
    lightText: '#1F1D1C',
    darkBg,
    darkSurface,
    darkText
  };
}

/**
 * Builds complete CSS overrides for :root and dark mode
 */
export function buildThemeCss(preset: ThemePreset): string {
  const primaryRgb = hexToRgb(preset.primary);
  const primaryContrast = getContrastColor(preset.primary);
  const primaryShade = shadeColor(preset.primary, 0.12);
  const primaryTint = tintColor(preset.primary, 0.15);

  const secondaryRgb = hexToRgb(preset.secondary);
  const secondaryContrast = getContrastColor(preset.secondary);
  const secondaryShade = shadeColor(preset.secondary, 0.12);
  const secondaryTint = tintColor(preset.secondary, 0.15);

  const tertiaryRgb = hexToRgb(preset.tertiary);
  const tertiaryContrast = getContrastColor(preset.tertiary);

  const lightBgRgb = hexToRgb(preset.lightBg);
  const lightTextRgb = hexToRgb(preset.lightText);

  const darkBgRgb = hexToRgb(preset.darkBg);
  const darkTextRgb = hexToRgb(preset.darkText);

  const darkToolbar = blend(preset.darkBg, preset.darkSurface, 0.5);
  const stepRules = generateStepVariables(preset.darkBg, preset.darkText);

  return `
/* FlowFit Dynamic Theme Override: ${preset.name} */
:root {
  --ion-color-primary: ${preset.primary};
  --ion-color-primary-rgb: ${rgbToString(primaryRgb)};
  --ion-color-primary-contrast: ${primaryContrast.hex};
  --ion-color-primary-contrast-rgb: ${primaryContrast.rgb};
  --ion-color-primary-shade: ${primaryShade};
  --ion-color-primary-tint: ${primaryTint};

  --ion-color-secondary: ${preset.secondary};
  --ion-color-secondary-rgb: ${rgbToString(secondaryRgb)};
  --ion-color-secondary-contrast: ${secondaryContrast.hex};
  --ion-color-secondary-contrast-rgb: ${secondaryContrast.rgb};
  --ion-color-secondary-shade: ${secondaryShade};
  --ion-color-secondary-tint: ${secondaryTint};

  --ion-color-tertiary: ${preset.tertiary};
  --ion-color-tertiary-rgb: ${rgbToString(tertiaryRgb)};
  --ion-color-tertiary-contrast: ${tertiaryContrast.hex};
  --ion-color-tertiary-contrast-rgb: ${tertiaryContrast.rgb};

  --ion-background-color: ${preset.lightBg};
  --ion-background-color-rgb: ${rgbToString(lightBgRgb)};
  --ion-text-color: ${preset.lightText};
  --ion-text-color-rgb: ${rgbToString(lightTextRgb)};
  --ion-card-background: ${preset.lightSurface};
  --ion-item-background: ${preset.lightSurface};
}

body.dark,
html.ion-palette-dark {
  --ion-color-primary: ${preset.primary};
  --ion-color-primary-rgb: ${rgbToString(primaryRgb)};
  --ion-color-primary-contrast: ${primaryContrast.hex};
  --ion-color-primary-contrast-rgb: ${primaryContrast.rgb};
  --ion-color-primary-shade: ${primaryShade};
  --ion-color-primary-tint: ${primaryTint};

  --ion-color-secondary: ${preset.secondary};
  --ion-color-secondary-rgb: ${rgbToString(secondaryRgb)};
  --ion-color-secondary-contrast: ${secondaryContrast.hex};
  --ion-color-secondary-contrast-rgb: ${secondaryContrast.rgb};
  --ion-color-secondary-shade: ${secondaryShade};
  --ion-color-secondary-tint: ${secondaryTint};

  --ion-color-tertiary: ${preset.tertiary};
  --ion-color-tertiary-rgb: ${rgbToString(tertiaryRgb)};
  --ion-color-tertiary-contrast: ${tertiaryContrast.hex};
  --ion-color-tertiary-contrast-rgb: ${tertiaryContrast.rgb};

  --ion-background-color: ${preset.darkBg};
  --ion-background-color-rgb: ${rgbToString(darkBgRgb)};
  --ion-text-color: ${preset.darkText};
  --ion-text-color-rgb: ${rgbToString(darkTextRgb)};
  --ion-card-background: ${preset.darkSurface};
  --ion-item-background: ${preset.darkSurface};
  --ion-toolbar-background: ${darkToolbar};
  --ion-tab-bar-background: ${darkToolbar};

${stepRules}
}
`;
}
