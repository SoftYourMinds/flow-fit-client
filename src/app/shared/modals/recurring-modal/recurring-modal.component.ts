import { Component, Input, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';

import { Client } from '../../../core/services/clients.service';
import { Location } from '../../../core/services/locations.service';
import {
  SessionsService,
  RecurringSessionsPayload,
  RecurringPreviewItem,
} from '../../../core/services/sessions.service';
import {
  SubscriptionsService,
  ClientSubscription,
} from '../../../core/services/subscriptions.service';
import { WORKOUT_TYPE_OPTIONS } from '../../../core/constants/workout-types.constant';

export interface DayOfWeekOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-recurring-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './recurring-modal.component.html',
  styleUrls: ['./recurring-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringModalComponent implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly sessionsService = inject(SessionsService);
  private readonly subscriptionsService = inject(SubscriptionsService);

  @Input() clients: Client[] = [];
  @Input() locations: Location[] = [];
  @Input() preselectedClientId?: number;
  @Input() preselectedSubscriptionId?: number;

  readonly DAYS_OF_WEEK: DayOfWeekOption[] = [
    { value: 1, label: 'Пн' },
    { value: 2, label: 'Вт' },
    { value: 3, label: 'Ср' },
    { value: 4, label: 'Чт' },
    { value: 5, label: 'Пт' },
    { value: 6, label: 'Сб' },
    { value: 0, label: 'Нд' },
  ];

  readonly WORKOUT_TYPE_OPTIONS = WORKOUT_TYPE_OPTIONS;

  clientId = signal<number | null>(null);
  locationId = signal<number | null>(null);
  selectedDays = signal<number[]>([1, 3, 5]);
  startTime = signal<string>('10:00');
  endTime = signal<string>('11:00');
  dateFrom = signal<string>(this.getTodayDateString());
  dateTo = signal<string>(this.getDefaultDateToString());
  subscriptionId = signal<number | null>(null);
  clientSubscriptions = signal<ClientSubscription[]>([]);
  workoutTypes = signal<string[]>([]);
  price = signal<number>(300);

  previewItems = signal<RecurringPreviewItem[]>([]);
  isPreviewLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // ─── Lifecycle ────────────────────────────────────────────────────

  ngOnInit(): void {
    if (this.locations.length > 0) {
      this.locationId.set(this.locations[0].id);
    }

    if (this.preselectedClientId) {
      this.clientId.set(this.preselectedClientId);
      this.loadClientSubscriptions(this.preselectedClientId);
    }

    if (this.preselectedSubscriptionId) {
      this.subscriptionId.set(this.preselectedSubscriptionId);
    }
  }

  // ─── Public Methods ─────────────────────────────────────────────

  cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  toggleDay(dayValue: number): void {
    const current = this.selectedDays();
    const exists = current.includes(dayValue);
    if (exists) {
      if (current.length === 1) return; // Keep at least one day
      this.selectedDays.set(current.filter((d) => d !== dayValue));
    } else {
      this.selectedDays.set([...current, dayValue].sort((a, b) => a - b));
    }
    this.previewItems.set([]); // Reset preview on criteria change
  }

  isDaySelected(dayValue: number): boolean {
    return this.selectedDays().includes(dayValue);
  }

  onClientSelect(event: CustomEvent): void {
    const id = Number(event.detail.value);
    this.clientId.set(id);
    this.subscriptionId.set(null);
    this.previewItems.set([]);
    if (id) {
      this.loadClientSubscriptions(id);
    } else {
      this.clientSubscriptions.set([]);
    }
  }

  onSubscriptionSelect(event: CustomEvent): void {
    const subId = event.detail.value ? Number(event.detail.value) : null;
    this.subscriptionId.set(subId);
    this.previewItems.set([]);

    if (subId) {
      const sub = this.clientSubscriptions().find((s) => s.id === subId);
      if (sub && sub.type === 'DATE_RANGE') {
        if (sub.startDate) this.dateFrom.set(sub.startDate.slice(0, 10));
        if (sub.endDate) this.dateTo.set(sub.endDate.slice(0, 10));
      }
    }
  }

  previewSchedule(): void {
    const payload = this.buildPayload();
    if (!payload) return;

    this.isPreviewLoading.set(true);
    this.errorMessage.set(null);

    this.sessionsService.previewRecurring(payload).subscribe({
      next: (items) => {
        this.previewItems.set(items);
        this.isPreviewLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Помилка при генерації графіка');
        this.isPreviewLoading.set(false);
      },
    });
  }

  confirmCreate(): void {
    const payload = this.buildPayload();
    if (!payload) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.sessionsService.createRecurring(payload).subscribe({
      next: async (created) => {
        this.isSubmitting.set(false);
        const toast = await this.toastCtrl.create({
          message: `Успішно створено ${created.length} тренувань!`,
          duration: 3000,
          color: 'success',
          position: 'bottom',
        });
        await toast.present();
        this.modalCtrl.dismiss({ created: true, count: created.length }, 'confirm');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Помилка при створенні тренувань');
        this.isSubmitting.set(false);
      },
    });
  }

  getDayLabel(dayOfWeek: number): string {
    const map: Record<number, string> = {
      0: 'Нд',
      1: 'Пн',
      2: 'Вт',
      3: 'Ср',
      4: 'Чт',
      5: 'Пт',
      6: 'Сб',
    };
    return map[dayOfWeek] || '';
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private buildPayload(): RecurringSessionsPayload | null {
    const clientId = this.clientId();
    const locationId = this.locationId();

    if (!clientId) {
      this.errorMessage.set('Оберіть клієнта');
      return null;
    }
    if (!locationId) {
      this.errorMessage.set('Оберіть локацію');
      return null;
    }
    if (this.selectedDays().length === 0) {
      this.errorMessage.set('Оберіть хоча б один день тижня');
      return null;
    }

    return {
      clientId,
      locationId,
      daysOfWeek: this.selectedDays(),
      startTime: this.startTime(),
      endTime: this.endTime(),
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      timezoneOffset: new Date().getTimezoneOffset(),
      subscriptionId: this.subscriptionId() ?? undefined,
      price: this.price(),
      workoutTypes: this.workoutTypes().length > 0 ? this.workoutTypes() : undefined,
    };
  }

  private loadClientSubscriptions(clientId: number): void {
    this.subscriptionsService.getActiveForClient(clientId).subscribe({
      next: (subs) => {
        this.clientSubscriptions.set(subs);
        if (this.preselectedSubscriptionId) {
          const found = subs.find((s) => s.id === this.preselectedSubscriptionId);
          if (found && found.type === 'DATE_RANGE') {
            if (found.startDate) this.dateFrom.set(found.startDate.slice(0, 10));
            if (found.endDate) this.dateTo.set(found.endDate.slice(0, 10));
          }
        }
      },
      error: () => this.clientSubscriptions.set([]),
    });
  }

  private getTodayDateString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getDefaultDateToString(): string {
    const d = new Date();
    d.setDate(d.getDate() + 28); // 4 weeks
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
