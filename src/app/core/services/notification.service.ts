import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import {
  LocalNotifications,
  ScheduleOptions,
  LocalNotificationSchema,
} from '@capacitor/local-notifications';
import { environment } from '../../../environments/environment';

/** Offset presets (in minutes as strings to match backend persistence) a user can choose from */
export type ReminderMode = 'auto' | '15' | '30' | '60' | '120' | '180';

export const REMINDER_MODE_LABELS: { value: ReminderMode; label: string }[] = [
  { value: 'auto', label: 'Автоматично' },
  { value: '15',   label: 'За 15 хвилин' },
  { value: '30',   label: 'За 30 хвилин' },
  { value: '60',   label: 'За 1 годину' },
  { value: '120',  label: 'За 2 години' },
  { value: '180',  label: 'За 3 години' },
];

/**
 * Soft limit — when active pending notifications reach this number we warn
 * the user. iOS hard limit is 64.
 */
const PENDING_SOFT_LIMIT = 50;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly alertCtrl = inject(AlertController);
  private readonly http = inject(HttpClient, { optional: true });
  private readonly swPush = inject(SwPush, { optional: true });

  // ─── Permission & Registration ──────────────────────────────────────────

  async requestPermission(): Promise<boolean> {
    if (this.isNative()) {
      try {
        const status = await LocalNotifications.requestPermissions();
        return status.display === 'granted';
      } catch {
        return false;
      }
    }

    // Web / PWA push permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await this.subscribeToPush();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
    return false;
  }

  async subscribeToPush(): Promise<boolean> {
    if (this.isNative() || !this.swPush?.isEnabled || !this.http) {
      return false;
    }

    try {
      const res = await firstValueFrom(
        this.http.get<{ publicKey: string }>(`${environment.apiUrl}/notifications/vapid-key`),
      );

      if (!res?.publicKey) {
        return false;
      }

      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: res.publicKey,
      });

      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/notifications/subscribe`, subscription.toJSON()),
      );
      return true;
    } catch (err) {
      console.warn('Web push subscription failed or dismissed:', err);
      return false;
    }
  }

  async unsubscribeFromPush(): Promise<void> {
    if (this.isNative() || !this.swPush?.isEnabled || !this.http) return;
    try {
      const sub = await firstValueFrom(this.swPush.subscription);
      if (sub) {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/notifications/unsubscribe`, {
            endpoint: sub.endpoint,
          }),
        );
        await this.swPush.unsubscribe();
      }
    } catch {
      // Ignore
    }
  }

  // ─── Schedule ────────────────────────────────────────────────────────────

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
      // Ensure push subscription exists if permission is granted.
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        this.subscribeToPush().catch(() => {});
      }
      return;
    }

    // Always clean up the old notification first
    await this.cancelForSession(session.id);

    const notificationAt = this.calcNotificationTime(session.startTime, reminderMode);
    if (!notificationAt || notificationAt <= new Date()) return; // already passed

    // Limit check
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

  // ─── Cancel ──────────────────────────────────────────────────────────────

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
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
    } catch {
      // Ignore
    }
  }

  // ─── Sync ────────────────────────────────────────────────────────────────

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

  // ─── Limit helper ────────────────────────────────────────────────────────

  async isAtLimit(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications.length >= PENDING_SOFT_LIMIT;
    } catch {
      return false;
    }
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

  // ─── Time calculation ────────────────────────────────────────────────────

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

  private calcAutoTime(sessionStart: Date, now: Date): Date {
    const hour = sessionStart.getHours();

    if (hour >= 7 && hour < 10) {
      const hoursUntil = (sessionStart.getTime() - now.getTime()) / 3600000;
      if (hoursUntil >= 12) {
        const evening = new Date(sessionStart);
        evening.setDate(evening.getDate() - 1);
        evening.setHours(20, 0, 0, 0);
        return evening;
      } else {
        return new Date(sessionStart.getTime() - 60 * 60 * 1000);
      }
    } else if (hour >= 10 && hour < 22) {
      return new Date(sessionStart.getTime() - 2 * 60 * 60 * 1000);
    } else {
      return new Date(sessionStart.getTime() - 60 * 60 * 1000);
    }
  }

  // ─── Text builder ────────────────────────────────────────────────────────

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

  // ─── Platform guard ──────────────────────────────────────────────────────

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }
}
