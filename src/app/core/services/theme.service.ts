import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'flowfit-theme';
  private isDark = false;

  constructor() { }

  public initTheme(): void {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    
    if (savedTheme) {
      this.isDark = savedTheme === 'dark';
    } else {
      // Fallback to system preference if no saved preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      this.isDark = prefersDark.matches;
    }
    
    this.applyTheme();
  }

  public get isDarkMode(): boolean {
    return this.isDark;
  }

  public setDarkMode(isDark: boolean): void {
    this.isDark = isDark;
    localStorage.setItem(this.THEME_KEY, isDark ? 'dark' : 'light');
    this.applyTheme();
  }

  public toggleTheme(): void {
    this.setDarkMode(!this.isDark);
  }

  private applyTheme(): void {
    if (this.isDark) {
      document.body.classList.add('dark');
      document.documentElement.classList.add('ion-palette-dark');
    } else {
      document.body.classList.remove('dark');
      document.documentElement.classList.remove('ion-palette-dark');
    }
  }
}
