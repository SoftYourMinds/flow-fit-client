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

import { Client, ClientsService } from '../../../core/services/clients.service';
import { Location, LocationsService } from '../../../core/services/locations.service';
import {
  SessionsService,
  RecurringPreviewItem,
  RecurringSessionsPayload,
  IndividualParticipantMode,
  SessionParticipantDraft,
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
import { WORKOUT_TYPE_OPTIONS } from '../../../core/constants/workout-types.constant';
import { SessionParticipantsEditorComponent } from '../../components/session-participants-editor/session-participants-editor.component';
import {
  normalizeParticipantsForIndividual,
  sanitizeParticipantsForApi,
  validateSessionParticipants,
} from '../../utils/session-participants.util';

export interface DayOfWeekOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-create-wizard-modal',
  imports: [CommonModule, FormsModule, IonicModule, SessionParticipantsEditorComponent],
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
  private readonly clientsService = inject(ClientsService);
  private readonly locationsService = inject(LocationsService);

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

  readonly WORKOUT_TYPE_OPTIONS = WORKOUT_TYPE_OPTIONS;

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
  readonly subClientActiveSubscriptions = signal<ClientSubscription[]>([]);

  // ─── Step 2B: Single Session State ─────────────────────────────
  readonly singleType = signal<'INDIVIDUAL' | 'GROUP'>('INDIVIDUAL');
  readonly singleIndividualMode = signal<IndividualParticipantMode>('ANONYMOUS');
  readonly singleAnonymousCount = signal<number>(1);
  readonly singleParticipants = signal<SessionParticipantDraft[]>([]);
  readonly singleClientSubscriptions = signal<ClientSubscription[]>([]);
  readonly deductFromSubscription = signal<boolean>(true);
  readonly selectedSubscriptionId = signal<number | null>(null);
  readonly singleLocationId = signal<number | null>(null);
  readonly singleStartTime = signal<string>(this.getLocalIsoString(new Date()));
  readonly singleDuration = signal<number>(50);
  readonly singlePrice = signal<number>(300);
  readonly singleWorkoutTypes = signal<string[]>([]);
  readonly enableNotification = signal<boolean>(true);
  readonly reminderMode = signal<ReminderMode>('auto');
  readonly isCritical = signal<boolean>(false);

  // ─── Reactive Data Lists ───────────────────────────────────────
  readonly clientList = signal<Client[]>([]);
  readonly isClientsLoading = signal<boolean>(false);
  readonly locationList = signal<Location[]>([]);
  readonly isLocationsLoading = signal<boolean>(false);

  readonly singleDatetimeId = `single-datetime-${Math.random().toString(36).substring(2, 9)}`;

  // ─── Computed ──────────────────────────────────────────────────
  readonly selectedSubClient = computed(() => {
    const id = this.subClientId();
    if (!id) return null;
    return this.clientList().find((c) => c.id === id) || null;
  });

  readonly selectedSingleClientId = computed<number | null>(() => {
    if (this.singleType() !== 'INDIVIDUAL' || this.singleIndividualMode() !== 'CLIENT') {
      return null;
    }
    return this.singleParticipants().find((p) => typeof p.clientId === 'number')?.clientId ?? null;
  });

  readonly selectedSingleClient = computed(() => {
    const id = this.selectedSingleClientId();
    if (!id) return null;
    return this.clientList().find((c) => c.id === id) || null;
  });

  readonly activeSubscriptionForSingle = computed(() => {
    const subs = this.singleClientSubscriptions();
    return subs.length > 0 ? subs[0] : null;
  });

  readonly subConflictCount = computed(() => {
    return this.subPreviewItems().filter((item) => item.hasConflict).length;
  });

  readonly hasOverlappingActiveSubscription = computed(() => {
    return this.subClientActiveSubscriptions().length > 0;
  });

  readonly activeSubDescription = computed(() => {
    const subs = this.subClientActiveSubscriptions();
    if (subs.length === 0) return '';
    const sub = subs[0];
    if (sub.type === 'SESSIONS_BASED') {
      const left = (sub.totalSessions || 0) - sub.usedSessions;
      return `по кількості (залишилось ${left} з ${sub.totalSessions})`;
    }
    return `по датах (до ${new Date(sub.endDate || '').toLocaleDateString('uk-UA')})`;
  });

  // ─── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    if (this.locations && this.locations.length > 0) {
      this.locationList.set(this.locations);
      this.initLocationDefaults(this.locations);
    } else {
      this.loadLocations();
    }

    if (this.clients && this.clients.length > 0) {
      this.clientList.set(this.clients);
    } else {
      this.loadClients();
    }

    if (this.preselectedClientId) {
      const preselectedClient = this.clientList().find((c) => c.id === this.preselectedClientId);
      this.subClientId.set(this.preselectedClientId);
      this.singleIndividualMode.set('CLIENT');
      this.singleAnonymousCount.set(0);
      this.singleParticipants.set([
        {
          clientId: this.preselectedClientId,
          client: preselectedClient
            ? {
                id: preselectedClient.id,
                fullName: preselectedClient.fullName,
                phone: preselectedClient.phone,
              }
            : undefined,
        },
      ]);
      this.loadSingleClientSubscriptions(this.preselectedClientId);
      this.checkSubClientActiveSubscriptions(this.preselectedClientId);
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
    this.checkSubClientActiveSubscriptions(id || null);
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
      timezoneOffset: new Date().getTimezoneOffset(),
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
    if (this.isSubmitting()) return;

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
    if (this.hasOverlappingActiveSubscription()) {
      this.errorMessage.set(
        'У клієнта вже є активний абонемент. Не можна створити декілька абонементів на один термін.',
      );
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
      timezoneOffset: new Date().getTimezoneOffset(),
      price: +this.subPrice(),
      isPaid: this.subIsPaid(),
      workoutTypes: this.subWorkoutTypes(),
    };

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.subscriptionsService.createWithRecurring(payload).subscribe({
      next: async (res) => {
        this.locationsService.saveLastSelectedLocationId(Number(locationId));
        await this.showToast(
          `Абонемент та ${res.sessionsCount} занять успішно створено!`,
          'success',
        );
        await this.modalCtrl.dismiss({ created: true, type: 'subscription', ...res }, 'confirm');
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
  setSingleType(type: 'INDIVIDUAL' | 'GROUP'): void {
    this.singleType.set(type);
    this.errorMessage.set(null);

    if (type === 'INDIVIDUAL') {
      const normalized = normalizeParticipantsForIndividual(this.singleParticipants());
      this.singleParticipants.set(normalized.participants);
      this.singleAnonymousCount.set(normalized.anonymousCount);
      this.singleIndividualMode.set(normalized.mode);
      this.syncSingleClientSubscriptions(normalized.participants);
      return;
    }

    this.clearSingleClientSubscriptions();
  }

  onSingleParticipantsChange(participants: SessionParticipantDraft[]): void {
    this.singleParticipants.set(participants);
    this.errorMessage.set(null);
    if (this.singleType() === 'INDIVIDUAL') {
      this.syncSingleClientSubscriptions(participants);
    }
  }

  onSingleAnonymousCountChange(count: number): void {
    this.singleAnonymousCount.set(Math.max(0, count));
    this.errorMessage.set(null);
  }

  onSingleIndividualModeChange(mode: IndividualParticipantMode): void {
    this.singleIndividualMode.set(mode);
    this.errorMessage.set(null);
    if (mode !== 'CLIENT') {
      this.clearSingleClientSubscriptions();
    }
  }

  loadClients(): void {
    this.isClientsLoading.set(true);
    this.clientsService.getAll().subscribe({
      next: (cls) => {
        this.clientList.set(cls || []);
        this.isClientsLoading.set(false);
      },
      error: () => {
        this.isClientsLoading.set(false);
      },
    });
  }

  loadLocations(): void {
    this.isLocationsLoading.set(true);
    this.locationsService.getAll().subscribe({
      next: (locs) => {
        const list = locs || [];
        this.locationList.set(list);
        this.initLocationDefaults(list);
        this.isLocationsLoading.set(false);
      },
      error: () => {
        this.isLocationsLoading.set(false);
      },
    });
  }

  onNotificationToggleChange(enabled: boolean): void {
    this.enableNotification.set(enabled);
    if (enabled) {
      void this.notificationService.ensureAccessForSessionCreation();
    }
  }

  async submitSingleSession(): Promise<void> {
    if (this.isSubmitting()) return;

    const locationId = this.singleLocationId();
    if (!locationId) {
      this.errorMessage.set('Оберіть локацію');
      return;
    }

    const sessionType = this.singleType();
    const anonymousParticipantsCount = Math.max(0, Number(this.singleAnonymousCount()) || 0);
    const participantsValidationError = validateSessionParticipants(
      sessionType,
      this.singleIndividualMode(),
      this.singleParticipants(),
      anonymousParticipantsCount,
    );
    if (participantsValidationError) {
      this.errorMessage.set(participantsValidationError);
      return;
    }

    const participants = sanitizeParticipantsForApi(this.singleParticipants());
    const start = new Date(this.singleStartTime());
    const end = new Date(start.getTime() + this.singleDuration() * 60000);
    const clientId = this.selectedSingleClientId();

    const activeSub = this.activeSubscriptionForSingle();
    const willDeduct =
      sessionType === 'INDIVIDUAL' &&
      Boolean(clientId) &&
      this.deductFromSubscription() &&
      Boolean(activeSub);

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      if (this.enableNotification()) {
        await this.notificationService.ensureAccessForSessionCreation();
      }

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
          anonymousParticipantsCount,
          participants,
          enableNotification: this.enableNotification(),
          reminderMode: String(this.reminderMode()),
          isCritical: this.isCritical(),
        }),
      );

      // Deduct from subscription if requested
      if (willDeduct && activeSub) {
        await firstValueFrom(
          this.subscriptionsService.deductSession(activeSub.id, createdSession.id),
        );
      }

      // Schedule notification
      if (this.enableNotification()) {
        const loc = this.locationList().find((l) => l.id === locationId);
        if (loc) {
          this.notificationService.scheduleForSession(
            createdSession,
            loc.name,
            this.reminderMode(),
          );
        }
      }

      this.locationsService.saveLastSelectedLocationId(Number(locationId));

      await this.showToast('Тренування успішно створено!', 'success');
      await this.modalCtrl.dismiss(
        { created: true, type: 'session', session: createdSession },
        'confirm',
      );
    } catch (err: unknown) {
      this.isSubmitting.set(false);
      const errorObj = err as { error?: { message?: string } };
      this.errorMessage.set(
        errorObj?.error?.message || 'Помилка при створенні тренування',
      );
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────
  private syncSingleClientSubscriptions(participants: SessionParticipantDraft[]): void {
    const clientId = participants.find((p) => typeof p.clientId === 'number')?.clientId ?? null;
    if (clientId) {
      this.loadSingleClientSubscriptions(clientId);
      return;
    }
    this.clearSingleClientSubscriptions();
  }

  private clearSingleClientSubscriptions(): void {
    this.singleClientSubscriptions.set([]);
    this.selectedSubscriptionId.set(null);
    this.deductFromSubscription.set(false);
  }
  private checkSubClientActiveSubscriptions(clientId: number | null): void {
    if (!clientId) {
      this.subClientActiveSubscriptions.set([]);
      return;
    }
    this.subscriptionsService.getActiveForClient(clientId).subscribe({
      next: (subs) => this.subClientActiveSubscriptions.set(subs),
      error: () => this.subClientActiveSubscriptions.set([]),
    });
  }

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
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getDefaultDateToString(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

  private initLocationDefaults(locs: Location[]): void {
    const defaultLocationId = this.locationsService.resolveDefaultLocationId(locs);
    if (!defaultLocationId) return;

    if (!this.subLocationId()) {
      this.subLocationId.set(defaultLocationId);
    }
    if (!this.singleLocationId()) {
      this.singleLocationId.set(defaultLocationId);
    }
  }
}
