import { Component, OnInit } from '@angular/core';
import { ThemeService } from './core/services/theme.service';
import { NotificationService } from './core/services/notification.service';
import { SessionsService } from './core/services/sessions.service';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private themeService: ThemeService,
    private notificationService: NotificationService,
    private sessionsService: SessionsService
  ) {
    this.themeService.initTheme();
  }

  async ngOnInit() {
    await this.notificationService.requestPermission();

    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        this.sessionsService.getAll().subscribe(data => {
          this.notificationService.syncNotifications(data);
        });
      }
    });

    Keyboard.addListener('keyboardWillShow', (info) => {
      const keyboardHeight = info.keyboardHeight;
      const contents = document.querySelectorAll('ion-content');
      contents.forEach((content: any) => {
        content.style.setProperty('--keyboard-offset', `${keyboardHeight}px`);
      });
    });

    Keyboard.addListener('keyboardWillHide', () => {
      const contents = document.querySelectorAll('ion-content');
      contents.forEach((content: any) => {
        content.style.setProperty('--keyboard-offset', '0px');
      });
    });
  }
}
