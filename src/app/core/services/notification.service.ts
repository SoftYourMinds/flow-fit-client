import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  ScheduleOptions,
  LocalNotificationSchema,
} from '@capacitor/local-notifications';

/** Offset presets (in minutes) a user can choose from */
export type ReminderMode = 'auto' | 15 | 30 | 60 | 120 | 180;

export const REMINDER_MODE_LABELS: { value: ReminderMode; label: string }[] = [
  { value: 'auto', label: 'Автоматично' },
  { value: 15,     label: 'За 15 хвилин' },
  { value: 30,     label: 'За 30 хвилин' },
  { value: 60,     label: 'За 1 годину' },
  { value: 120,    label: 'За 2 години' },
  { value: 180,    label: 'За 3 години' },
];

/**
 * Soft limit — when active pending notifications reach this number we warn
 * the user. iOS hard limit is 64.
 */
const PENDING_SOFT_LIMIT = 50;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private alertCtrl: AlertController) {}

  // ─── Permission ──────────────────────────────────────────────────────────

  async requestPermission(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch {
      return false;
    }
  }

  // ─── Schedule ────────────────────────────────────────────────────────────

  /**
   * Schedule a reminder for a single session.
   * If a notification already exists for this session, it is cancelled first.
   *
   * @param session  WorkoutSession object (must have id, startTime, locationId)
   * @param locationName  Human-readable location name
   * @param reminderMode  'auto' or a fixed number of minutes before the session
   */
  async scheduleForSession(
    session: { id: number; startTime: string; locationId: number },
    locationName: string,
    reminderMode: ReminderMode = 'auto'
  ): Promise<void> {
    if (!this.isNative()) return;

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

    const notification: LocalNotificationSchema = {
      id: session.id,
      title: '🏋️ Нагадування про тренування',
      body: this.buildBody(session.startTime, locationName, reminderMode),
      schedule: { at: notificationAt },
      sound: 'default',
      channelId: 'default',
    };

    const options: ScheduleOptions = { notifications: [notification] };
    await LocalNotifications.schedule(options);
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
        await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }
    } catch { /* ignore */ }
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

      // Build a set of upcoming session IDs
      const upcomingIds = new Set(
        sessions
          .filter(s => s.status === 'UPCOMING' && new Date(s.startTime) > now)
          .map(s => s.id)
      );

      // Cancel notifications for sessions that no longer exist or are past
      const toCancel = pending.notifications
        .filter(n => !upcomingIds.has(n.id))
        .map(n => ({ id: n.id }));

      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel });
      }
    } catch { /* ignore */ }
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

  /**
   * Returns the Date when the notification should fire.
   * Returns null if the computed time is already in the past.
   */
  calcNotificationTime(startTimeIso: string, mode: ReminderMode): Date | null {
    const sessionStart = new Date(startTimeIso);
    const now = new Date();

    let notifyAt: Date;

    if (mode !== 'auto') {
      // Fixed offset: N minutes before session
      notifyAt = new Date(sessionStart.getTime() - mode * 60 * 1000);
    } else {
      notifyAt = this.calcAutoTime(sessionStart, now);
    }

    return notifyAt > now ? notifyAt : null;
  }

  private calcAutoTime(sessionStart: Date, now: Date): Date {
    const hour = sessionStart.getHours();

    if (hour >= 7 && hour < 10) {
      // Morning session (7–10)
      const hoursUntil = (sessionStart.getTime() - now.getTime()) / 3600000;
      if (hoursUntil >= 12) {
        // Created day before → notify previous evening at 20:00
        const evening = new Date(sessionStart);
        evening.setDate(evening.getDate() - 1);
        evening.setHours(20, 0, 0, 0);
        return evening;
      } else {
        // Created same evening → notify 1 hour before
        return new Date(sessionStart.getTime() - 60 * 60 * 1000);
      }
    } else if ((hour >= 10 && hour < 22)) {
      // Day or Evening session → 2 hours before
      return new Date(sessionStart.getTime() - 2 * 60 * 60 * 1000);
    } else {
      // Outside working hours → 1 hour before
      return new Date(sessionStart.getTime() - 60 * 60 * 1000);
    }
  }

  // ─── Text builder ────────────────────────────────────────────────────────

  private buildBody(
    startTimeIso: string,
    locationName: string,
    mode: ReminderMode
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
