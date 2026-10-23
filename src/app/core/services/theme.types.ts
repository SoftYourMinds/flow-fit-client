export type ThemeMode = 'light' | 'dark' | 'system';

export type DarkBgTone = 'oled' | 'charcoal' | 'tinted';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  tertiary: string;
  lightBg: string;
  lightSurface: string;
  lightText: string;
  darkBg: string;
  darkSurface: string;
  darkText: string;
}

export interface CustomThemeConfig {
  primary: string;
  secondary: string;
  tertiary?: string;
  darkTone: DarkBgTone;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'terracotta',
    name: 'Теракота',
    description: 'Оригінальний теплий нюд FlowFit',
    primary: '#C88A72',
    secondary: '#A68A78',
    tertiary: '#D6A77A',
    lightBg: '#FAF7F4',
    lightSurface: '#FFFFFF',
    lightText: '#2D2725',
    darkBg: '#141211',
    darkSurface: '#1F1B1A',
    darkText: '#F5EFEB'
  },
  {
    id: 'emerald',
    name: 'Смарагд',
    description: 'Свіжий зелений фітнес та баланс',
    primary: '#10B981',
    secondary: '#059669',
    tertiary: '#34D399',
    lightBg: '#F2FAF6',
    lightSurface: '#FFFFFF',
    lightText: '#102A1E',
    darkBg: '#0B1612',
    darkSurface: '#14251F',
    darkText: '#EDF7F2'
  },
  {
    id: 'cyberpunk',
    name: 'Кіберпанк',
    description: 'Електричний фіолетовий та неоновий стиль',
    primary: '#8B5CF6',
    secondary: '#6366F1',
    tertiary: '#A78BFA',
    lightBg: '#F7F5FE',
    lightSurface: '#FFFFFF',
    lightText: '#1F1736',
    darkBg: '#0E0C1B',
    darkSurface: '#1A162E',
    darkText: '#F3F0FC'
  },
  {
    id: 'ocean',
    name: 'Океан',
    description: 'Глибокий сапфір та спокій',
    primary: '#2563EB',
    secondary: '#0EA5E9',
    tertiary: '#38BDF8',
    lightBg: '#F2F7FD',
    lightSurface: '#FFFFFF',
    lightText: '#101D35',
    darkBg: '#0B1324',
    darkSurface: '#13203A',
    darkText: '#EEF4FE'
  },
  {
    id: 'crimson',
    name: 'Багряний',
    description: 'Вибухова енергія та вогонь',
    primary: '#EF4444',
    secondary: '#F97316',
    tertiary: '#FB923C',
    lightBg: '#FEF5F5',
    lightSurface: '#FFFFFF',
    lightText: '#341414',
    darkBg: '#1A0B0B',
    darkSurface: '#281414',
    darkText: '#FCEEEE'
  },
  {
    id: 'amber',
    name: 'Бурштин',
    description: 'Тепле золото та захід сонця',
    primary: '#F59E0B',
    secondary: '#D97706',
    tertiary: '#FBBF24',
    lightBg: '#FDF9F2',
    lightSurface: '#FFFFFF',
    lightText: '#2D1E0A',
    darkBg: '#18130B',
    darkSurface: '#261F12',
    darkText: '#FDF6EA'
  },
  {
    id: 'nordic',
    name: 'Графіт',
    description: 'Скандинавський сталевий мінімалізм',
    primary: '#64748B',
    secondary: '#475569',
    tertiary: '#94A3B8',
    lightBg: '#F8FAFC',
    lightSurface: '#FFFFFF',
    lightText: '#0F172A',
    darkBg: '#0F1117',
    darkSurface: '#191D26',
    darkText: '#F1F5F9'
  },
  {
    id: 'rose',
    name: 'Півонія',
    description: 'Витончений рожевий люкс',
    primary: '#EC4899',
    secondary: '#D946EF',
    tertiary: '#F472B6',
    lightBg: '#FDF4F8',
    lightSurface: '#FFFFFF',
    lightText: '#301022',
    darkBg: '#180D15',
    darkSurface: '#271422',
    darkText: '#FCEBF4'
  }
];
