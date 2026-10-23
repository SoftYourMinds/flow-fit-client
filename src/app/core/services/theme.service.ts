import { Injectable, signal, computed } from '@angular/core';
import { 
  ThemeMode, 
  ThemePreset, 
  CustomThemeConfig, 
  THEME_PRESETS 
} from './theme.types';
import { 
  buildThemeCss, 
  buildCustomPreset, 
  hexToRgb, 
  rgbToString, 
  getHarmoniousColor 
} from './theme-utils';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEYS = {
    MODE: 'flowfit-theme-mode',
    LEGACY_THEME: 'flowfit-theme',
    PRESET: 'flowfit-theme-preset',
    CUSTOM: 'flowfit-custom-theme'
  };

  private readonly DEFAULT_CUSTOM: CustomThemeConfig = {
    primary: '#8B5CF6',
    secondary: '#EC4899',
    tertiary: '#C084FC',
    darkTone: 'charcoal'
  };

  // Reactive state signals
  public readonly presets: ThemePreset[] = THEME_PRESETS;
  public readonly themeMode = signal<ThemeMode>('system');
  public readonly isDark = signal<boolean>(false);
  public readonly activePresetId = signal<string>('terracotta');
  public readonly customConfig = signal<CustomThemeConfig>(this.DEFAULT_CUSTOM);

  public readonly activePreset = computed<ThemePreset>(() => {
    const id = this.activePresetId();
    if (id === 'custom') {
      return buildCustomPreset(this.customConfig());
    }
    const found = this.presets.find(p => p.id === id);
    return found || this.presets[0];
  });

  private mediaQueryList: MediaQueryList | null = null;
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {}

  /**
   * Initializes theme settings from localStorage or defaults
   */
  public initTheme(): void {
    if (typeof window === 'undefined') return;

    // 1. Initialize Preset
    const savedPreset = localStorage.getItem(this.STORAGE_KEYS.PRESET);
    if (savedPreset) {
      this.activePresetId.set(savedPreset);
    }

    // 2. Initialize Custom Theme config
    const savedCustom = localStorage.getItem(this.STORAGE_KEYS.CUSTOM);
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        this.customConfig.set({ ...this.DEFAULT_CUSTOM, ...parsed });
      } catch {
        this.customConfig.set(this.DEFAULT_CUSTOM);
      }
    }

    // 3. Initialize Mode (light / dark / system)
    const savedMode = localStorage.getItem(this.STORAGE_KEYS.MODE) as ThemeMode | null;
    const legacySaved = localStorage.getItem(this.STORAGE_KEYS.LEGACY_THEME);

    let initialMode: ThemeMode = 'system';
    if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
      initialMode = savedMode;
    } else if (legacySaved === 'dark' || legacySaved === 'light') {
      initialMode = legacySaved;
    }
    this.themeMode.set(initialMode);

    // 4. Set up system dark mode watcher
    this.setupSystemMediaWatcher();

    // 5. Apply theme & CSS variables
    this.applyCurrentTheme();
  }

  /**
   * Backwards compatible getter for isDarkMode
   */
  public get isDarkMode(): boolean {
    return this.isDark();
  }

  /**
   * Backwards compatible setter for dark mode
   */
  public setDarkMode(isDark: boolean): void {
    this.setThemeMode(isDark ? 'dark' : 'light');
  }

  /**
   * Backwards compatible toggle
   */
  public toggleTheme(): void {
    const nextDark = !this.isDark();
    this.setThemeMode(nextDark ? 'dark' : 'light');
  }

  /**
   * Updates display mode ('light' | 'dark' | 'system')
   */
  public setThemeMode(mode: ThemeMode): void {
    this.themeMode.set(mode);
    localStorage.setItem(this.STORAGE_KEYS.MODE, mode);
    this.applyCurrentTheme();
  }

  /**
   * Selects an active preset or 'custom'
   */
  public setPreset(presetId: string): void {
    this.activePresetId.set(presetId);
    localStorage.setItem(this.STORAGE_KEYS.PRESET, presetId);
    this.applyCurrentTheme();
  }

  /**
   * Updates custom theme configuration and applies it
   */
  public updateCustomConfig(partial: Partial<CustomThemeConfig>): void {
    const current = this.customConfig();
    const updated: CustomThemeConfig = {
      ...current,
      ...partial
    };

    // If primary changed and secondary wasn't explicitly provided, auto-harmonize secondary
    if (partial.primary && !partial.secondary && partial.primary !== current.primary) {
      updated.secondary = getHarmoniousColor(partial.primary, 35);
    }

    this.customConfig.set(updated);
    localStorage.setItem(this.STORAGE_KEYS.CUSTOM, JSON.stringify(updated));

    if (this.activePresetId() === 'custom') {
      this.applyCurrentTheme();
    }
  }

  /**
   * Resets custom theme configuration to vibrant defaults
   */
  public resetCustomConfig(): void {
    this.customConfig.set(this.DEFAULT_CUSTOM);
    localStorage.setItem(this.STORAGE_KEYS.CUSTOM, JSON.stringify(this.DEFAULT_CUSTOM));
    if (this.activePresetId() === 'custom') {
      this.applyCurrentTheme();
    }
  }

  /**
   * Applies the resolved dark/light state and compiles dynamic theme styles
   */
  private applyCurrentTheme(): void {
    const mode = this.themeMode();
    let darkActive = false;

    if (mode === 'dark') {
      darkActive = true;
    } else if (mode === 'light') {
      darkActive = false;
    } else {
      // System
      darkActive = this.isSystemDark();
    }

    this.isDark.set(darkActive);
    localStorage.setItem(this.STORAGE_KEYS.LEGACY_THEME, darkActive ? 'dark' : 'light');

    if (typeof document !== 'undefined') {
      if (darkActive) {
        document.body.classList.add('dark');
        document.documentElement.classList.add('ion-palette-dark');
      } else {
        document.body.classList.remove('dark');
        document.documentElement.classList.remove('ion-palette-dark');
      }

      // Compile & inject active theme CSS
      const preset = this.activePreset();
      const css = buildThemeCss(preset);
      this.updateRuntimeStyles(css);
      this.updateRootVariables(preset);
    }
  }

  private isSystemDark(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private setupSystemMediaWatcher(): void {
    if (typeof window === 'undefined') return;

    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaListener = (e: MediaQueryListEvent) => {
      if (this.themeMode() === 'system') {
        this.applyCurrentTheme();
      }
    };

    if (this.mediaQueryList.addEventListener) {
      this.mediaQueryList.addEventListener('change', this.mediaListener);
    } else {
      // Older browser fallback
      (this.mediaQueryList as any).addListener(this.mediaListener);
    }
  }

  private updateRuntimeStyles(css: string): void {
    if (typeof document === 'undefined') return;
    let styleEl = document.getElementById('flowfit-theme-runtime') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'flowfit-theme-runtime';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  private updateRootVariables(preset: ThemePreset): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const primaryRgb = hexToRgb(preset.primary);
    const secondaryRgb = hexToRgb(preset.secondary);

    root.style.setProperty('--ion-color-primary', preset.primary);
    root.style.setProperty('--ion-color-primary-rgb', rgbToString(primaryRgb));
    root.style.setProperty('--ion-color-secondary', preset.secondary);
    root.style.setProperty('--ion-color-secondary-rgb', rgbToString(secondaryRgb));
    root.style.setProperty('--ion-color-tertiary', preset.tertiary);
  }
}
