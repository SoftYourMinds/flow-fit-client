import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AlertController, ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  ScheduleOptions,
  LocalNotificationSchema,
} from '@capacitor/local-notifications';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

/** Offset presets (in minutes as strings to match backend persistence) a user can choose from */
export type ReminderMode = 'auto' | '15' | '30' | '60' | '120' | '180';

export type PushAccessStatus = 'granted' | 'denied' | 'unsupported' | 'needs-homescreen';

export interface TestPushResponse {
  success: boolean;
  totalSubscriptions: number;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

export const REMINDER_MODE_LABELS: { value: ReminderMode; label: string }[] = [
  { value: 'auto', label: 'Автоматично' },
  { value: '15', label: 'За 15 хвилин' },
  { value: '30', label: 'За 30 хвилин' },
  { value: '60', label: 'За 1 годину' },
  { value: '120', label: 'За 2 години' },
  { value: '180', label: 'За 3 години' },
];

/**
 * Soft limit — when active pending notifications reach this number we warn
 * the user. iOS hard limit is 64.
 */
const PENDING_SOFT_LIMIT = 50;
const SESSION_PROMPTED_KEY = 'flowfit_push_prompted';
const SESSION_IOS_INSTALL_KEY = 'flowfit_ios_install_hint_shown';
const SESSION_DENIED_HINT_KEY = 'flowfit_push_denied_hint_shown';

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly http = inject(HttpClient, { optional: true });

  private cachedVapidKey: string | null = null;
  private vapidKeyPromise: Promise<string | null> | null = null;
  private isPromptShowing = false;

  // ─── Signals & Platform State ──────────────────────────────────

  readonly permissionState = signal<NotificationPermission | 'unsupported'>(
    this.readBrowserPermission(),
  );
  readonly isPushSubscribed = signal<boolean>(false);
  readonly backendSubscriptionCount = signal<number | null>(null);
  readonly isIosDevice = signal<boolean>(this.isIosBrowser());
  readonly isStandalonePwa = signal<boolean>(this.isStandaloneMode());

  readonly pushStatusText = computed<string>(() => {
    if (this.isNative()) {
      return this.permissionState() === 'granted' ? 'Активно (Native)' : 'Потрібен дозвіл';
    }
    if (this.needsIosHomeScreenInstall()) {
      return 'Додайте PWA на екран «Домой» в Safari';
    }
    if (!this.isWebPushSupported()) {
      return 'Браузер не підтримує Web Push';
    }

    const permission = this.permissionState();
    if (permission === 'denied') {
      return 'Заблоковано в налаштуваннях пристрою';
    }
    if (permission === 'default') {
      return 'Потрібен дозвіл на сповіщення';
    }
    if (this.isPushSubscribed()) {
      const count = this.backendSubscriptionCount();
      return count !== null ? `Активно (підписок у БД: ${count})` : 'Активно';
    }
    return 'Дозвіл є, очікує підписки Service Worker';
  });

  // ─── Public Methods ─────────────────────────────────────────────

  async prefetchVapidKey(): Promise<string | null> {
    if (this.cachedVapidKey) return this.cachedVapidKey;
    if (!this.http || this.isNative()) return null;
    if (this.vapidKeyPromise) return this.vapidKeyPromise;

    const headers = new HttpHeaders({
      'x-silent-request': 'true',
      'x-silent-error': 'true',
    });

    this.vapidKeyPromise = firstValueFrom(
      this.http.get<{ publicKey: string }>(`${environment.apiUrl}/notifications/vapid-key`, {
        headers,
      }),
    )
      .then((res) => {
        if (res?.publicKey) {
          this.cachedVapidKey = res.publicKey;
          return res.publicKey;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        this.vapidKeyPromise = null;
      });

    return this.vapidKeyPromise;
  }

  async refreshPushState(): Promise<void> {
    this.isIosDevice.set(this.isIosBrowser());
    this.isStandalonePwa.set(this.isStandaloneMode());

    if (this.isNative()) {
      try {
        const status = await LocalNotifications.checkPermissions();
        this.permissionState.set(status.display === 'granted' ? 'granted' : 'default');
      } catch {
        this.permissionState.set('default');
      }
      return;
    }

    this.permissionState.set(this.readBrowserPermission());

    const sub = await this.getActiveBrowserSubscription();
    this.isPushSubscribed.set(Boolean(sub));

    if (this.http && this.hasAuthToken()) {
      const headers = new HttpHeaders({
        'x-silent-request': 'true',
        'x-silent-error': 'true',
      });
      try {
        const status = await firstValueFrom(
          this.http.get<{ subscriptionCount: number }>(
            `${environment.apiUrl}/notifications/status`,
            { headers },
          ),
        );
        this.backendSubscriptionCount.set(status?.subscriptionCount ?? null);
      } catch {
        // Ignore silent status check errors
      }
    }
  }

  /**
   * Checkpoint 1: Called from AppComponent after loading screen completes and user is authenticated.
   */
  async checkAccessAfterAppLoad(): Promise<void> {
    await this.refreshPushState();

    if (this.isNative()) {
      if (this.permissionState() !== 'granted') {
        await this.requestNativePermission();
      }
      return;
    }

    if (!this.hasAuthToken()) return;
    if (localStorage.getItem('notificationsEnabled') === 'false') return;

    if (this.needsIosHomeScreenInstall()) {
      await this.presentIosInstallHintIfNeeded();
      return;
    }

    if (!this.isWebPushSupported()) return;

    const permission = this.readBrowserPermission();
    if (permission === 'granted') {
      await this.subscribeToPush({ silent: true });
      return;
    }

    if (permission === 'default') {
      await this.presentEnablePushPromptAfterLoad();
    }
  }

  /**
   * Checkpoint 2: Called synchronously from user tap when creating/saving a workout with reminders enabled.
   * Calls Notification.requestPermission() BEFORE any async await so iOS WebKit preserves user activation.
   */
  async ensureAccessForSessionCreation(showDeniedWarning = true): Promise<PushAccessStatus> {
    if (this.isNative()) {
      const granted = await this.requestNativePermission();
      return granted ? 'granted' : 'denied';
    }

    if (this.needsIosHomeScreenInstall()) {
      await this.showToast(
        'Для Web Push на iPhone додайте FlowFit на екран «Домой» (Поділитися → На екран «Домой»).',
        'warning',
      );
      return 'needs-homescreen';
    }

    if (!this.isWebPushSupported()) {
      return 'unsupported';
    }

    const currentPermission = Notification.permission;
    this.permissionState.set(currentPermission);

    if (currentPermission === 'granted') {
      await this.subscribeToPush({ silent: true });
      return 'granted';
    }

    if (currentPermission === 'default') {
      try {
        const requested = await Notification.requestPermission();
        this.permissionState.set(requested);
        if (requested === 'granted') {
          localStorage.setItem('notificationsEnabled', 'true');
          await this.subscribeToPush({ silent: true });
          return 'granted';
        }
        if (showDeniedWarning) {
          await this.showToast(
            'Дозвіл на сповіщення не надано — нагадування у браузері не прийдуть.',
            'warning',
          );
        }
        return 'denied';
      } catch {
        return 'denied';
      }
    }

    if (showDeniedWarning && !sessionStorage.getItem(SESSION_DENIED_HINT_KEY)) {
      sessionStorage.setItem(SESSION_DENIED_HINT_KEY, '1');
      await this.showToast(
        'Сповіщення заблоковані в налаштуваннях браузера або iOS. Увімкніть їх у Параметрах.',
        'warning',
      );
    }
    return 'denied';
  }

  /**
   * User-initiated permission + push subscription (Settings toggle, button tap, Alert confirm).
   */
  async requestPermission(): Promise<boolean> {
    if (this.isNative()) {
      return this.requestNativePermission();
    }

    if (this.needsIosHomeScreenInstall()) {
      await this.presentIosInstallAlert();
      return false;
    }

    if (!this.isWebPushSupported()) {
      await this.showToast('Цей браузер не підтримує Web Push сповіщення.', 'warning');
      return false;
    }

    try {
      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
      this.permissionState.set(permission);

      if (permission !== 'granted') {
        return false;
      }

      localStorage.setItem('notificationsEnabled', 'true');
      return await this.subscribeToPush({ silent: false });
    } catch {
      return false;
    }
  }

  async subscribeToPush(options: { silent?: boolean } = {}): Promise<boolean> {
    if (this.isNative() || !this.isWebPushSupported() || !this.http) {
      return false;
    }
    if (!this.hasAuthToken()) {
      return false;
    }

    try {
      const registration = await this.getServiceWorkerRegistration();
      if (!registration?.pushManager) {
        if (!options.silent) {
          await this.showToast(
            'Service Worker ще не активний (у dev-режимі PWA вимкнено або сторінку потрібно перезавантажити).',
            'warning',
          );
        }
        return false;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const publicKey = this.cachedVapidKey ?? (await this.prefetchVapidKey());
        if (!publicKey) {
          return false;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(publicKey),
        });
      }

      const headers = options.silent
        ? new HttpHeaders({ 'x-silent-request': 'true', 'x-silent-error': 'true' })
        : undefined;

      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/notifications/subscribe`,
          subscription.toJSON(),
          headers ? { headers } : undefined,
        ),
      );

      this.isPushSubscribed.set(true);
      await this.refreshPushState();
      return true;
    } catch (err) {
      console.warn('Web push subscription failed or dismissed:', err);
      this.isPushSubscribed.set(false);
      return false;
    }
  }

  async unsubscribeFromPush(): Promise<void> {
    if (this.isNative() || !this.http) return;

    try {
      const sub = await this.getActiveBrowserSubscription();
      if (sub) {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/notifications/unsubscribe`, {
            endpoint: sub.endpoint,
          }),
        );
        await sub.unsubscribe();
      }
    } catch {
      // Ignore
    } finally {
      this.isPushSubscribed.set(false);
      await this.refreshPushState();
    }
  }

  async sendTestPush(): Promise<TestPushResponse> {
    if (!this.http) {
      return {
        success: false,
        totalSubscriptions: 0,
        sentCount: 0,
        failedCount: 0,
        errors: ['HttpClient недоступний'],
      };
    }

    const granted = await this.requestPermission();
    if (!granted && this.permissionState() !== 'granted') {
      return {
        success: false,
        totalSubscriptions: this.backendSubscriptionCount() ?? 0,
        sentCount: 0,
        failedCount: 0,
        errors: [this.pushStatusText()],
      };
    }

    return firstValueFrom(
      this.http.post<TestPushResponse>(`${environment.apiUrl}/notifications/test`, {}),
    );
  }

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  isIosBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isStandardIos = /iPad|iPhone|iPod/.test(ua);
    const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isStandardIos || isIpadOs;
  }

  isStandaloneMode(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const nav = navigator as NavigatorWithStandalone;
    return Boolean(nav.standalone) || window.matchMedia('(display-mode: standalone)').matches;
  }

  needsIosHomeScreenInstall(): boolean {
    return !this.isNative() && this.isIosBrowser() && !this.isStandaloneMode();
  }

  isWebPushSupported(): boolean {
    return (
      !this.isNative() &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  // ─── Schedule (Native LocalNotifications) ──────────────────────

  /**
   * Schedule a reminder for a single session.
   * If a notification already exists for this session, it is cancelled first.
   */
  async scheduleForSession(
    session: { id: number; startTime: string; locationId: number },
    locationName: string,
    reminderMode: ReminderMode | number = 'auto',
    isLastSubscriptionSession = false,
  ): Promise<void> {
    if (!this.isNative()) {
      // In PWA, push notifications are dispatched by backend cron/scheduler.
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        void this.subscribeToPush({ silent: true });
      }
      return;
    }

    await this.cancelForSession(session.id);

    const notificationAt = this.calcNotificationTime(session.startTime, reminderMode);
    if (!notificationAt || notificationAt <= new Date()) return;

    const limited = await this.isAtLimit();
    if (limited) {
      await this.showLimitAlert();
      return;
    }

    let body = this.buildBody(session.startTime, locationName, reminderMode);
    if (isLastSubscriptionSession) {
      body += '\n⚠️ Останнє заняття по абонементу!';
    }

    const notification: LocalNotificationSchema = {
      id: session.id,
      title: '🏋️ Нагадування про тренування',
      body,
      schedule: { at: notificationAt },
      sound: 'default',
      channelId: 'default',
    };

    const options: ScheduleOptions = { notifications: [notification] };
    await LocalNotifications.schedule(options);
  }

  /**
   * Schedule native push notification for subscription expiration (3 days before endDate).
   */
  async scheduleSubscriptionExpiry(sub: {
    id: number;
    endDate: string;
    clientName: string;
  }): Promise<void> {
    if (!this.isNative()) return;

    const subNotificationId = 1_000_000 + sub.id;
    await this.cancelSubscriptionExpiry(sub.id);

    const endDate = new Date(sub.endDate);
    const fireDate = new Date(endDate);
    fireDate.setDate(fireDate.getDate() - 3);
    fireDate.setHours(10, 0, 0, 0);

    if (fireDate <= new Date()) return;

    const limited = await this.isAtLimit();
    if (limited) {
      await this.showLimitAlert();
      return;
    }

    const notification: LocalNotificationSchema = {
      id: subNotificationId,
      title: '⚠️ Абонемент закінчується',
      body: `Через 3 дні закінчується абонемент клієнта ${sub.clientName}. Запропонуйте продовження!`,
      schedule: { at: fireDate },
      sound: 'default',
      channelId: 'default',
    };

    await LocalNotifications.schedule({ notifications: [notification] });
  }

  async cancelSubscriptionExpiry(subId: number): Promise<void> {
    if (!this.isNative()) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: 1_000_000 + subId }] });
    } catch {
      // Ignore – notification may not exist
    }
  }

  async cancelForSession(sessionId: number): Promise<void> {
    if (!this.isNative()) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: sessionId }] });
    } catch {
      // Ignore – notification may not exist
    }
  }

  async cancelAll(): Promise<void> {
    if (!this.isNative()) return;
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Called on app resume / initial load.
   * Removes notifications for sessions that are already in the past.
   */
  async syncNotifications(
    sessions: Array<{ id: number; startTime: string; status: string }>,
  ): Promise<void> {
    if (!this.isNative()) return;
    try {
      const pending = await LocalNotifications.getPending();
      const now = new Date();

      const upcomingIds = new Set(
        sessions
          .filter((s) => s.status === 'UPCOMING' && new Date(s.startTime) > now)
          .map((s) => s.id),
      );

      const toCancel = pending.notifications
        .filter((n) => !upcomingIds.has(n.id))
        .map((n) => ({ id: n.id }));

      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel });
      }
    } catch {
      // Ignore
    }
  }

  async isAtLimit(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications.length >= PENDING_SOFT_LIMIT;
    } catch {
      return false;
    }
  }

  calcNotificationTime(startTimeIso: string, mode: ReminderMode | number): Date | null {
    const sessionStart = new Date(startTimeIso);
    const now = new Date();

    let notifyAt: Date;
    const minutes = mode === 'auto' ? NaN : Number(mode);

    if (!Number.isNaN(minutes)) {
      notifyAt = new Date(sessionStart.getTime() - minutes * 60 * 1000);
    } else {
      notifyAt = this.calcAutoTime(sessionStart, now);
    }

    return notifyAt > now ? notifyAt : null;
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private async requestNativePermission(): Promise<boolean> {
    try {
      const status = await LocalNotifications.requestPermissions();
      const granted = status.display === 'granted';
      this.permissionState.set(granted ? 'granted' : 'denied');
      return granted;
    } catch {
      return false;
    }
  }

  private async presentEnablePushPromptAfterLoad(): Promise<void> {
    if (this.isPromptShowing || sessionStorage.getItem(SESSION_PROMPTED_KEY)) {
      return;
    }

    sessionStorage.setItem(SESSION_PROMPTED_KEY, '1');
    this.isPromptShowing = true;

    try {
      const alert = await this.alertCtrl.create({
        header: '🔔 Увімкнути сповіщення?',
        message: 'Дозвольте push-сповіщення, щоб отримувати нагадування про тренування на телефон.',
        buttons: [
          {
            text: 'Пізніше',
            role: 'cancel',
          },
          {
            text: 'Увімкнути',
            handler: () => {
              // Runs synchronously inside button tap so iOS Safari preserves user activation
              void this.requestPermission();
            },
          },
        ],
      });
      await alert.present();
    } finally {
      this.isPromptShowing = false;
    }
  }

  private async presentIosInstallHintIfNeeded(): Promise<void> {
    if (this.isPromptShowing || sessionStorage.getItem(SESSION_IOS_INSTALL_KEY)) {
      return;
    }
    sessionStorage.setItem(SESSION_IOS_INSTALL_KEY, '1');
    await this.presentIosInstallAlert();
  }

  private async presentIosInstallAlert(): Promise<void> {
    if (this.isPromptShowing) return;
    this.isPromptShowing = true;
    try {
      const alert = await this.alertCtrl.create({
        header: '📲 Додайте FlowFit на екран «Домой»',
        message:
          'На iPhone push-сповіщення працюють лише в режимі встановленої PWA. ' +
          'Натисніть у Safari кнопку «Поділитися» → «На екран «Домой» та відкрийте додаток з іконки.',
        buttons: ['Зрозуміло'],
      });
      await alert.present();
    } finally {
      this.isPromptShowing = false;
    }
  }

  private async getActiveBrowserSubscription(): Promise<PushSubscription | null> {
    if (!this.isWebPushSupported()) return null;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.pushManager) return null;
      return await registration.pushManager.getSubscription();
    } catch {
      return null;
    }
  }

  private async getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    const existing = await navigator.serviceWorker.getRegistration();
    if (existing?.active && existing.pushManager) {
      return existing;
    }

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 5000);
    });

    const readyRegistration = await Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
    if (readyRegistration) {
      return readyRegistration;
    }

    return (await navigator.serviceWorker.getRegistration()) ?? null;
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);

    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  private readBrowserPermission(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  private hasAuthToken(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem('access_token'));
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3500,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  private async showLimitAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '⚠️ Ліміт сповіщень',
      message:
        'Досягнуто ліміту запланованих сповіщень iOS (50+). ' +
        'Нові нагадування не можуть бути заплановані. ' +
        'Видаліть або перегляньте старі заняття з нагадуваннями.',
      buttons: ['Зрозуміло'],
    });
    await alert.present();
  }

  private calcAutoTime(sessionStart: Date, now: Date): Date {
    const hour = sessionStart.getHours();

    if (hour >= 7 && hour < 10) {
      const hoursUntil = (sessionStart.getTime() - now.getTime()) / 3600000;
      if (hoursUntil >= 12) {
        const evening = new Date(sessionStart);
        evening.setDate(evening.getDate() - 1);
        evening.setHours(20, 0, 0, 0);
        return evening;
      }
      return new Date(sessionStart.getTime() - 60 * 60 * 1000);
    }

    if (hour >= 10 && hour < 22) {
      return new Date(sessionStart.getTime() - 2 * 60 * 60 * 1000);
    }

    return new Date(sessionStart.getTime() - 60 * 60 * 1000);
  }

  private buildBody(
    startTimeIso: string,
    locationName: string,
    mode: ReminderMode | number,
  ): string {
    const sessionStart = new Date(startTimeIso);
    const timeStr = sessionStart.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (mode === 'auto') {
      const hour = sessionStart.getHours();
      if (hour >= 7 && hour < 10) {
        const hoursUntil = (sessionStart.getTime() - new Date().getTime()) / 3600000;
        if (hoursUntil >= 12) {
          return `Завтра о ${timeStr} — тренування на «${locationName}»`;
        }
      }
    }
    return `о ${timeStr} — тренування на «${locationName}»`;
  }
}
