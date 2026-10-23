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
import { DarkBgTone, ThemeMode } from '../../core/services/theme.types';
import { getHarmoniousColor } from '../../core/services/theme-utils';

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

  // Custom theme controls state
  customPrimaryHex = '#8B5CF6';
  customSecondaryHex = '#EC4899';
  showCustomEditor = false;

  readonly recommendedColors = [
    '#C88A72', // FlowFit Terracotta
    '#10B981', // Emerald
    '#8B5CF6', // Cyber Violet
    '#2563EB', // Sapphire Blue
    '#EF4444', // Crimson Red
    '#F59E0B', // Amber Gold
    '#06B6D4', // Aqua Cyan
    '#EC4899', // Blossom Pink
  ];

  constructor() { }

  ngOnInit() {
    const saved = localStorage.getItem('notificationsEnabled');
    if (saved !== null) {
      this.notificationsEnabled = saved === 'true';
    }

    // Sync initial custom colors from themeService
    const custom = this.themeService.customConfig();
    this.customPrimaryHex = custom.primary;
    this.customSecondaryHex = custom.secondary;
    if (this.themeService.activePresetId() === 'custom') {
      this.showCustomEditor = true;
    }
  }

  onThemeModeChange(event: any) {
    const mode = event.detail?.value as ThemeMode;
    if (mode) {
      this.themeService.setThemeMode(mode);
    }
  }

  selectPreset(presetId: string) {
    this.themeService.setPreset(presetId);
  }

  selectCustomTheme() {
    this.showCustomEditor = true;
    this.themeService.setPreset('custom');
  }

  toggleCustomEditor() {
    this.showCustomEditor = !this.showCustomEditor;
    if (this.showCustomEditor && this.themeService.activePresetId() !== 'custom') {
      this.themeService.setPreset('custom');
    }
  }

  onPrimaryColorChange(event: any) {
    const color = event.target?.value || event;
    if (this.isValidHex(color)) {
      this.customPrimaryHex = color;
      this.themeService.updateCustomConfig({ primary: color });
      this.customSecondaryHex = this.themeService.customConfig().secondary;
    }
  }

  onSecondaryColorChange(event: any) {
    const color = event.target?.value || event;
    if (this.isValidHex(color)) {
      this.customSecondaryHex = color;
      this.themeService.updateCustomConfig({ secondary: color });
    }
  }

  applyCustomPrimaryHex() {
    let hex = this.customPrimaryHex?.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (this.isValidHex(hex)) {
      this.customPrimaryHex = hex;
      this.themeService.updateCustomConfig({ primary: hex });
      this.customSecondaryHex = this.themeService.customConfig().secondary;
    }
  }

  applyCustomSecondaryHex() {
    let hex = this.customSecondaryHex?.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (this.isValidHex(hex)) {
      this.customSecondaryHex = hex;
      this.themeService.updateCustomConfig({ secondary: hex });
    }
  }

  pickQuickPrimary(color: string) {
    this.customPrimaryHex = color;
    this.themeService.updateCustomConfig({ primary: color });
    this.customSecondaryHex = this.themeService.customConfig().secondary;
  }

  autoHarmonizeSecondary() {
    const harmonized = getHarmoniousColor(this.customPrimaryHex, 35);
    this.customSecondaryHex = harmonized;
    this.themeService.updateCustomConfig({ secondary: harmonized });
  }

  onDarkToneChange(event: any) {
    const tone = event.detail?.value as DarkBgTone;
    if (tone) {
      this.themeService.updateCustomConfig({ darkTone: tone });
    }
  }

  resetCustomTheme() {
    this.themeService.resetCustomConfig();
    const custom = this.themeService.customConfig();
    this.customPrimaryHex = custom.primary;
    this.customSecondaryHex = custom.secondary;
  }

  private isValidHex(hex: string): boolean {
    return /^#([0-9a-fA-F]{3}){1,2}$/.test(hex);
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
