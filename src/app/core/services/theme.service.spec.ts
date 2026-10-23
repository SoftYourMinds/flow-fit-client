import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { THEME_PRESETS } from './theme.types';
import { 
  hexToRgb, 
  rgbToHex, 
  getContrastColor, 
  shadeColor, 
  tintColor, 
  blend, 
  getHarmoniousColor,
  buildThemeCss
} from './theme-utils';

describe('Theme Utilities', () => {
  it('should parse hex to rgb correctly', () => {
    const rgb = hexToRgb('#C88A72');
    expect(rgb.r).toBe(200);
    expect(rgb.g).toBe(138);
    expect(rgb.b).toBe(114);
  });

  it('should format rgb to hex correctly', () => {
    expect(rgbToHex(200, 138, 114).toLowerCase()).toBe('#c88a72');
  });

  it('should calculate appropriate contrast color', () => {
    // Dark color should return white contrast
    expect(getContrastColor('#141211').hex).toBe('#FFFFFF');
    // Light color should return dark contrast
    expect(getContrastColor('#FFFFFF').hex).toBe('#141211');
  });

  it('should shade and tint colors correctly', () => {
    const shade = shadeColor('#FFFFFF', 0.2);
    expect(shade.toLowerCase()).toBe('#cccccc');

    const tint = tintColor('#000000', 0.5);
    expect(tint.toLowerCase()).toBe('#808080');
  });

  it('should blend two colors properly', () => {
    const blended = blend('#000000', '#FFFFFF', 0.5);
    expect(blended.toLowerCase()).toBe('#808080');
  });

  it('should generate a harmonious color by shifting hue', () => {
    const harmonious = getHarmoniousColor('#10B981', 35);
    expect(harmonious).toBeTruthy();
    expect(harmonious.startsWith('#')).toBeTrue();
  });

  it('should generate valid CSS rules from a preset', () => {
    const css = buildThemeCss(THEME_PRESETS[0]);
    expect(css).toContain(':root');
    expect(css).toContain('body.dark');
    expect(css).toContain('--ion-color-primary: #C88A72');
    expect(css).toContain('--ion-color-step-50');
  });
});

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [ThemeService]
    });
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default terracotta preset', () => {
    service.initTheme();
    expect(service.activePresetId()).toBe('terracotta');
    expect(service.activePreset().primary).toBe('#C88A72');
  });

  it('should switch preset and persist to localStorage', () => {
    service.initTheme();
    service.setPreset('emerald');
    expect(service.activePresetId()).toBe('emerald');
    expect(service.activePreset().primary).toBe('#10B981');
    expect(localStorage.getItem('flowfit-theme-preset')).toBe('emerald');
  });

  it('should support custom theme configuration', () => {
    service.initTheme();
    service.setPreset('custom');
    service.updateCustomConfig({ primary: '#3B82F6', darkTone: 'oled' });

    expect(service.activePresetId()).toBe('custom');
    const custom = service.activePreset();
    expect(custom.primary).toBe('#3B82F6');
    expect(custom.darkBg).toBe('#000000');
  });

  it('should toggle theme between light and dark', () => {
    service.initTheme();
    service.setThemeMode('light');
    expect(service.isDarkMode).toBeFalse();

    service.toggleTheme();
    expect(service.isDarkMode).toBeTrue();
    expect(service.themeMode()).toBe('dark');
  });
});
