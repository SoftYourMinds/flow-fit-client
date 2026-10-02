import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule, AlertController, NavController, LoadingController } from '@ionic/angular';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { TelegramService } from '../../core/services/telegram.service';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule]
})
export class SettingsComponent implements OnInit {
  readonly appVersion = environment.appVersion || '0.2.0';
  notificationsEnabled = true;

  public themeService = inject(ThemeService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private telegramService = inject(TelegramService);
  private alertCtrl = inject(AlertController);
  private navCtrl = inject(NavController);
  private loadingCtrl = inject(LoadingController);

  constructor() { }

  ngOnInit() {
    const saved = localStorage.getItem('notificationsEnabled');
    if (saved !== null) {
      this.notificationsEnabled = saved === 'true';
    }
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  async onNotificationsToggle(event: any) {
    const isChecked = event.detail.checked;

    if (!isChecked) {
      const alert = await this.alertCtrl.create({
        header: 'Вимкнути сповіщення?',
        message: 'Ви дійсно бажаєте вимкнути сповіщення? Усі заплановані нагадування будуть скасовані.',
        buttons: [
          {
            text: 'Скасувати',
            role: 'cancel',
            handler: () => {
              this.notificationsEnabled = true;
            }
          },
          {
            text: 'Вимкнути',
            role: 'destructive',
            handler: async () => {
              await this.notificationService.cancelAll();
              localStorage.setItem('notificationsEnabled', 'false');
            }
          }
        ]
      });
      await alert.present();
    } else {
      localStorage.setItem('notificationsEnabled', 'true');
    }
  }

  logout() {
    this.notificationService.cancelAll();
    this.authService.logout();
    this.navCtrl.navigateRoot('/login');
  }

  async connectTelegram() {
    const loading = await this.loadingCtrl.create({
      message: 'Генерація токена...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const res = await firstValueFrom(this.telegramService.getLinkToken());
      const token = res.token;
      const botUrl = `https://t.me/FlowFit_Trainer_Bot?start=${token}`;

      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: botUrl });
      } else {
        window.open(botUrl, '_blank');
      }
    } catch (err) {
      const alert = await this.alertCtrl.create({
        header: 'Помилка',
        message: 'Не вдалося згенерувати токен для підключення.',
        buttons: ['ОК']
      });
      await alert.present();
    } finally {
      await loading.dismiss();
    }
  }
}
