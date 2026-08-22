import { Component, OnInit, inject } from '@angular/core';
import { ThemeService } from './core/services/theme.service';
import { NotificationService } from './core/services/notification.service';
import { SessionsService } from './core/services/sessions.service';
import { AuthService } from './core/auth/auth.service';
import { AppInitService } from './core/services/app-init.service';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';

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

  constructor() {
    this.themeService.initTheme();
  }

  // ─── Lifecycle Hooks ─────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.appInitService.startAppInitialization();
    await this.notificationService.requestPermission();
    this.setupAppStateListener();
    this.setupKeyboardListeners();
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private setupAppStateListener(): void {
    App.addListener('appStateChange', ({ isActive }) => {
      const shouldSync = isActive && this.authService.isAuthenticated();
      if (!shouldSync) return;

      this.sessionsService.getAll().subscribe((data) => {
        this.notificationService.syncNotifications(data);
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


