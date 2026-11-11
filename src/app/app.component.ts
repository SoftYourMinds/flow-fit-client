import { Component, OnInit, effect, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';

import { ThemeService } from './core/services/theme.service';
import { NotificationService } from './core/services/notification.service';
import { SessionsService } from './core/services/sessions.service';
import { AuthService } from './core/auth/auth.service';
import { AppInitService } from './core/services/app-init.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  readonly appInitService = inject(AppInitService);
  private readonly themeService = inject(ThemeService);
  private readonly notificationService = inject(NotificationService);
  private readonly sessionsService = inject(SessionsService);
  private readonly authService = inject(AuthService);

  private hasCompletedInitialBoot = false;
  private wasAuthenticated = this.authService.isAuthenticated();

  constructor() {
    this.themeService.initTheme();

    // Check push access right after user logs in during an active session
    effect(() => {
      const isAuthenticated = this.authService.isAuthenticated();
      const justLoggedIn = this.hasCompletedInitialBoot && !this.wasAuthenticated && isAuthenticated;
      this.wasAuthenticated = isAuthenticated;

      if (justLoggedIn) {
        void this.notificationService.checkAccessAfterAppLoad();
      }
    });
  }

  // ─── Lifecycle Hooks ─────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    void this.notificationService.prefetchVapidKey();
    this.setupAppStateListener();
    this.setupKeyboardListeners();

    await this.appInitService.startAppInitialization();
    this.hasCompletedInitialBoot = true;

    if (this.authService.isAuthenticated()) {
      await this.notificationService.checkAccessAfterAppLoad();
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private setupAppStateListener(): void {
    App.addListener('appStateChange', ({ isActive }) => {
      const shouldSync = isActive && this.authService.isAuthenticated();
      if (!shouldSync) return;

      void this.notificationService.refreshPushState();
      this.sessionsService.getAll().subscribe((data) => {
        void this.notificationService.syncNotifications(data);
      });
    });
  }

  private setupKeyboardListeners(): void {
    Keyboard.addListener('keyboardWillShow', (info) => {
      this.updateKeyboardOffset(`${info.keyboardHeight}px`);
    });

    Keyboard.addListener('keyboardWillHide', () => {
      this.updateKeyboardOffset('0px');
    });
  }

  private updateKeyboardOffset(offset: string): void {
    const contents = document.querySelectorAll<HTMLElement>('ion-content');
    contents.forEach((content) => {
      content.style.setProperty('--keyboard-offset', offset);
    });
  }
}
