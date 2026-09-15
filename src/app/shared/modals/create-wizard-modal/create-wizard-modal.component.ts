import {
  Component,
  OnInit,
  Input,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { Client } from '../../../core/services/clients.service';
import { Location } from '../../../core/services/locations.service';
import {
  SessionsService,
  RecurringPreviewItem,
  RecurringSessionsPayload,
} from '../../../core/services/sessions.service';
import {
  SubscriptionsService,
  ClientSubscription,
  CreateSubscriptionWithRecurringPayload,
} from '../../../core/services/subscriptions.service';
import {
  NotificationService,
  ReminderMode,
  REMINDER_MODE_LABELS,
} from '../../../core/services/notification.service';

export interface DayOfWeekOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-create-wizard-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './create-wizard-modal.component.html',
  styleUrls: ['./create-wizard-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateWizardModalComponent implements OnInit {
  // ─── Dependencies ──────────────────────────────────────────────
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly sessionsService = inject(SessionsService);
  private readonly subscriptionsService = inject(SubscriptionsService);
  private readonly notificationService = inject(NotificationService);

  // ─── Inputs ────────────────────────────────────────────────────
  @Input() locations: Location[] = [];
  @Input() clients: Client[] = [];
  @Input() preselectedClientId?: number;
  @Input() preselectedDate?: string;

  // ─── Constants ─────────────────────────────────────────────────
  readonly DAYS_OF_WEEK: DayOfWeekOption[] = [
    { value: 1, label: 'Пн' },
    { value: 2, label: 'Вт' },
    { value: 3, label: 'Ср' },
    { value: 4, label: 'Чт' },
    { value: 5, label: 'Пт' },
    { value: 6, label: 'Сб' },
    { value: 0, label: 'Нд' },
  ];

  readonly WORKOUT_TYPE_OPTIONS: string[] = [
    'stretching',
    'fly stretching',
    'yoga',
    'functional',
    'pilates',
    'power pilates',
  ];

  readonly SESSION_COUNT_PRESETS: number[] = [4, 8, 10, 12];
  readonly REMINDER_MODES = REMINDER_MODE_LABELS;

  // ─── Wizard Step State ─────────────────────────────────────────
  readonly currentStep = signal<'TYPE_CHOICE' | 'SUBSCRIPTION' | 'SINGLE'>('TYPE_CHOICE');
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // ─── Step 2A: Subscription / Recurring Series State ────────────
  readonly subClientId = signal<number | null>(null);
  readonly subLocationId = signal<number | null>(null);
  readonly subTotalSessions = signal<number>(8);
  readonly subPrice = signal<number>(2400);
  readonly subIsPaid = signal<boolean>(false);
  readonly subDaysOfWeek = signal<number[]>([1, 3, 5]);
  readonly subStartTime = signal<string>('10:00');
  readonly subDuration = signal<number>(50);
  readonly subDateFrom = signal<string>(this.getTodayDateString());
  readonly subDateTo = signal<string>(this.getDefaultDateToString());
  readonly subWorkoutTypes = signal<string[]>([]);
  readonly subPreviewItems = signal<RecurringPreviewItem[]>([]);
  readonly isSubPreviewLoading = signal<boolean>(false);

  // ─── Step 2B: Single Session State ─────────────────────────────
  readonly singleType = signal<'INDIVIDUAL' | 'GROUP'>('INDIVIDUAL');
  readonly singleClientId = signal<number | null>(null);
  readonly singleClientSubscriptions = signal<ClientSubscription[]>([]);
  readonly deductFromSubscription = signal<boolean>(true);
  readonly selectedSubscriptionId = signal<number | null>(null);
  readonly singleLocationId = signal<number | null>(null);
  readonly singleStartTime = signal<string>(this.getLocalIsoString(new Date()));
  readonly singleDuration = signal<number>(50);
  readonly singlePrice = signal<number>(300);
  readonly singleMaxParticipants = signal<number | null>(null);
  readonly singleWorkoutTypes = signal<string[]>([]);
  readonly enableNotification = signal<boolean>(true);
  readonly reminderMode = signal<ReminderMode>('auto');

  readonly singleDatetimeId = `single-datetime-${Math.random().toString(36).substring(2, 9)}`;

  // ─── Computed ──────────────────────────────────────────────────
  readonly selectedSubClient = computed(() => {
    const id = this.subClientId();
    if (!id) return null;
    return this.clients.find((c) => c.id === id) || null;
  });

  readonly selectedSingleClient = computed(() => {
    const id = this.singleClientId();
    if (!id) return null;
    return this.clients.find((c) => c.id === id) || null;
  });

  readonly activeSubscriptionForSingle = computed(() => {
    const subs = this.singleClientSubscriptions();
    return subs.length > 0 ? subs[0] : null;
  });

  readonly subConflictCount = computed(() => {
    return this.subPreviewItems().filter((item) => item.hasConflict).length;
  });

  // ─── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    if (this.locations.length > 0) {
      this.subLocationId.set(this.locations[0].id);
      this.singleLocationId.set(this.locations[0].id);
    }

    if (this.preselectedClientId) {
      this.subClientId.set(this.preselectedClientId);
      this.singleClientId.set(this.preselectedClientId);
      this.loadSingleClientSubscriptions(this.preselectedClientId);
    }

    if (this.preselectedDate) {
      this.subDateFrom.set(this.preselectedDate);
      const targetDate = new Date(this.preselectedDate + 'T10:00:00');
      this.singleStartTime.set(this.getLocalIsoString(targetDate));
    }
  }

  // ─── Public Navigation Methods ─────────────────────────────────
  cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  goToStep(step: 'TYPE_CHOICE' | 'SUBSCRIPTION' | 'SINGLE'): void {
    this.errorMessage.set(null);
    this.currentStep.set(step);

    if (step === 'SUBSCRIPTION' && this.subPreviewItems().length === 0) {
      this.generateSubPreview();
    }
  }

  // ─── Subscription / Recurring Methods ─────────────────────────
  setSubClient(event: CustomEvent): void {
    const id = Number(event.detail.value);
    this.subClientId.set(id || null);
    this.subPreviewItems.set([]);
    this.generateSubPreview();
  }

  toggleDay(dayValue: number): void {
    const current = this.subDaysOfWeek();
    const exists = current.includes(dayValue);
    if (exists) {
      if (current.length === 1) return;
      this.subDaysOfWeek.set(current.filter((d) => d !== dayValue));
    } else {
      this.subDaysOfWeek.set([...current, dayValue].sort((a, b) => a - b));
    }
    this.generateSubPreview();
  }

  isDaySelected(dayValue: number): boolean {
    return this.subDaysOfWeek().includes(dayValue);
  }

  setSubTotalSessions(count: number): void {
    this.subTotalSessions.set(count);
    this.subPrice.set(count * 300);
  }

  generateSubPreview(): void {
    const clientId = this.subClientId();
    const locationId = this.subLocationId();
    if (!clientId || !locationId) return;

    const payload: RecurringSessionsPayload = {
      clientId,
      locationId,
      daysOfWeek: this.subDaysOfWeek(),
      startTime: this.subStartTime(),
      endTime: this.calculateEndTime(this.subStartTime(), this.subDuration()),
      dateFrom: this.subDateFrom(),
      dateTo: this.subDateTo(),
      workoutTypes: this.subWorkoutTypes(),
    };

    this.isSubPreviewLoading.set(true);
    this.errorMessage.set(null);

    this.sessionsService.previewRecurring(payload).subscribe({
      next: (items) => {
        this.subPreviewItems.set(items);
        this.isSubPreviewLoading.set(false);
      },
      error: (err) => {
        this.isSubPreviewLoading.set(false);
        this.errorMessage.set(
          err?.error?.message || 'Не вдалося перевірити розклад на конфлікти',
        );
      },
    });
  }

  async submitSubscription(): Promise<void> {
    const clientId = this.subClientId();
    const locationId = this.subLocationId();

    if (!clientId) {
      this.errorMessage.set('Будь ласка, оберіть клієнта');
      return;
    }
    if (!locationId) {
      this.errorMessage.set('Будь ласка, оберіть локацію');
      return;
    }

    const payload: CreateSubscriptionWithRecurringPayload = {
      clientId,
      locationId,
      daysOfWeek: this.subDaysOfWeek(),
      startTime: this.subStartTime(),
      endTime: this.calculateEndTime(this.subStartTime(), this.subDuration()),
      dateFrom: this.subDateFrom(),
      dateTo: this.subDateTo(),
      price: +this.subPrice(),
      isPaid: this.subIsPaid(),
      workoutTypes: this.subWorkoutTypes(),
    };

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.subscriptionsService.createWithRecurring(payload).subscribe({
      next: async (res) => {
        this.isSubmitting.set(false);
        await this.showToast(
          `Абонемент та ${res.sessionsCount} занять успішно створено!`,
          'success',
        );
        this.modalCtrl.dismiss({ created: true, type: 'subscription', ...res }, 'confirm');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err?.error?.message || 'Помилка при створенні абонементу та графіку',
        );
      },
    });
  }

  // ─── Single Session Methods ────────────────────────────────────
  onSingleClientChange(event: CustomEvent): void {
    const id = Number(event.detail.value);
    this.singleClientId.set(id || null);
    if (id) {
      this.loadSingleClientSubscriptions(id);
    } else {
      this.singleClientSubscriptions.set([]);
      this.selectedSubscriptionId.set(null);
    }
  }

  async submitSingleSession(): Promise<void> {
    const locationId = this.singleLocationId();
    if (!locationId) {
      this.errorMessage.set('Оберіть локацію');
      return;
    }

    const start = new Date(this.singleStartTime());
    const end = new Date(start.getTime() + this.singleDuration() * 60000);
    const sessionType = this.singleType();
    const clientId = this.singleClientId();

    const activeSub = this.activeSubscriptionForSingle();
    const willDeduct =
      sessionType === 'INDIVIDUAL' &&
      clientId &&
      this.deductFromSubscription() &&
      activeSub;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      const createdSession = await firstValueFrom(
        this.sessionsService.create({
          locationId: Number(locationId),
          type: sessionType,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          price: willDeduct ? 0 : +this.singlePrice(),
          status: 'UPCOMING',
          isPaid: willDeduct ? true : false,
          workoutTypes: this.singleWorkoutTypes(),
          maxParticipants:
            sessionType === 'GROUP' ? this.singleMaxParticipants() : 1,
        }),
      );

      // Add individual client as participant
      if (sessionType === 'INDIVIDUAL' && clientId) {
        await firstValueFrom(
          this.sessionsService.addParticipant(createdSession.id, { clientId }),
        );
      }

      // Deduct from subscription if requested
      if (willDeduct && activeSub) {
        await firstValueFrom(
          this.subscriptionsService.deductSession(activeSub.id, createdSession.id),
        );
      }

      // Schedule notification
      if (this.enableNotification()) {
        const loc = this.locations.find((l) => l.id === locationId);
        if (loc) {
          this.notificationService.scheduleForSession(
            createdSession,
            loc.name,
            this.reminderMode(),
          );
        }
      }

      this.isSubmitting.set(false);
      await this.showToast('Тренування успішно створено!', 'success');
      this.modalCtrl.dismiss(
        { created: true, type: 'session', session: createdSession },
        'confirm',
      );
    } catch (err: any) {
      this.isSubmitting.set(false);
      this.errorMessage.set(
        err?.error?.message || 'Помилка при створенні тренування',
      );
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────
  private loadSingleClientSubscriptions(clientId: number): void {
    this.subscriptionsService.getActiveForClient(clientId).subscribe({
      next: (subs) => {
        this.singleClientSubscriptions.set(subs);
        if (subs.length > 0) {
          this.selectedSubscriptionId.set(subs[0].id);
          this.deductFromSubscription.set(true);
        } else {
          this.selectedSubscriptionId.set(null);
          this.deductFromSubscription.set(false);
        }
      },
      error: () => {
        this.singleClientSubscriptions.set([]);
        this.selectedSubscriptionId.set(null);
        this.deductFromSubscription.set(false);
      },
    });
  }

  formatPreviewDate(dateStr: string): string {
    const d = new Date(dateStr);
    const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const monthNames = [
      'січ',
      'лют',
      'бер',
      'квіт',
      'трав',
      'черв',
      'лип',
      'серп',
      'вер',
      'жовт',
      'лист',
      'груд',
    ];
    const dow = dayNames[d.getDay()];
    const day = d.getDate();
    const month = monthNames[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${dow}, ${day} ${month} • ${hours}:${mins}`;
  }

  private calculateEndTime(start: string, durationMin: number): string {
    const [h, m] = start.split(':').map(Number);
    const totalMinutes = h * 60 + m + durationMin;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }

  private getTodayDateString(): string {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }

  private getDefaultDateToString(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().slice(0, 10);
  }

  private getLocalIsoString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
