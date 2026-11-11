import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  IonicModule,
  AlertController,
  NavController,
  LoadingController,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { firstValueFrom } from 'rxjs';

import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { TelegramService } from '../../core/services/telegram.service';
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
export class SettingsComponent implements OnInit, ViewWillEnter {
  readonly appVersion = environment.appVersion || '0.3.0';
  readonly notificationsEnabled = signal<boolean>(false);
  readonly isSendingTestPush = signal<boolean>(false);

  public readonly themeService = inject(ThemeService);
  public readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private readonly telegramService = inject(TelegramService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly navCtrl = inject(NavController);
  private readonly loadingCtrl = inject(LoadingController);

  private lastToggleChecked = false;

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

  ngOnInit(): void {
    void this.syncNotificationToggleState();

    // Sync initial custom colors from themeService
    const custom = this.themeService.customConfig();
    this.customPrimaryHex = custom.primary;
    this.customSecondaryHex = custom.secondary;
    if (this.themeService.activePresetId() === 'custom') {
      this.showCustomEditor = true;
    }
  }

  ionViewWillEnter(): void {
    void this.syncNotificationToggleState();
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

  async onNotificationsToggle(event: CustomEvent<{ checked: boolean }>): Promise<void> {
    const isChecked = Boolean(event.detail?.checked);
    if (isChecked === this.lastToggleChecked) return;

    this.lastToggleChecked = isChecked;
    this.notificationsEnabled.set(isChecked);

    if (!isChecked) {
      const alert = await this.alertCtrl.create({
        header: 'Вимкнути сповіщення?',
        message: 'Ви дійсно бажаєте вимкнути сповіщення? Усі заплановані нагадування будуть скасовані.',
        buttons: [
          {
            text: 'Скасувати',
            role: 'cancel',
            handler: () => {
              this.lastToggleChecked = true;
              this.notificationsEnabled.set(true);
            },
          },
          {
            text: 'Вимкнути',
            role: 'destructive',
            handler: async () => {
              await this.notificationService.cancelAll();
              await this.notificationService.unsubscribeFromPush();
              localStorage.setItem('notificationsEnabled', 'false');
            },
          },
        ],
      });
      await alert.present();
      return;
    }

    const granted = await this.notificationService.requestPermission();
    if (!granted) {
      this.lastToggleChecked = false;
      this.notificationsEnabled.set(false);
      return;
    }

    localStorage.setItem('notificationsEnabled', 'true');
  }

  // Temporary test action for verifying Web Push delivery on device
  async sendTestPush(): Promise<void> {
    if (this.isSendingTestPush()) return;
    this.isSendingTestPush.set(true);

    try {
      const result = await this.notificationService.sendTestPush();
      await this.syncNotificationToggleState();

      if (result.sentCount > 0) {
        const toast = await this.toastCtrl.create({
          message: `Тестове сповіщення надіслано (${result.sentCount} з ${result.totalSubscriptions})!`,
          duration: 3500,
          color: 'success',
          position: 'bottom',
        });
        await toast.present();
        return;
      }

      const reason =
        result.errors.length > 0
          ? result.errors.join('\n')
          : result.totalSubscriptions === 0
            ? 'У базі даних немає жодної push-підписки для цього пристрою.'
            : 'Сервіс push не зміг доставити сповіщення.';

      const alert = await this.alertCtrl.create({
        header: 'Тестовий пуш не доставлено',
        message: `Статус: ${this.notificationService.pushStatusText()}\n\nДеталі: ${reason}`,
        buttons: ['Зрозуміло'],
      });
      await alert.present();
    } catch (err: unknown) {
      const errorObj = err as { error?: { message?: string }; message?: string };
      const alert = await this.alertCtrl.create({
        header: 'Помилка тесту Web Push',
        message: errorObj?.error?.message || errorObj?.message || 'Не вдалося надіслати тестове сповіщення.',
        buttons: ['ОК'],
      });
      await alert.present();
    } finally {
      this.isSendingTestPush.set(false);
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
    } catch {
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

  // ─── Private Helpers ────────────────────────────────────────────

  private isValidHex(hex: string): boolean {
    return /^#([0-9a-fA-F]{3}){1,2}$/.test(hex);
  }

  private async syncNotificationToggleState(): Promise<void> {
    await this.notificationService.refreshPushState();
    const savedDisabled = localStorage.getItem('notificationsEnabled') === 'false';

    const enabled = this.notificationService.isNative()
      ? !savedDisabled && this.notificationService.permissionState() === 'granted'
      : !savedDisabled &&
        this.notificationService.permissionState() === 'granted' &&
        this.notificationService.isPushSubscribed();

    this.lastToggleChecked = enabled;
    this.notificationsEnabled.set(enabled);
  }
}
