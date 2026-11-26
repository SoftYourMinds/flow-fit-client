import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertController,
  IonicModule,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { LocationsService, Location } from '../../../core/services/locations.service';
import { ClientsService, Client } from '../../../core/services/clients.service';
import {
  IndividualParticipantMode,
  SessionParticipantDraft,
  SessionsService,
  WorkoutSession,
} from '../../../core/services/sessions.service';
import {
  ClientSubscription,
  SubscriptionsService,
} from '../../../core/services/subscriptions.service';
import {
  NotificationService,
  ReminderMode,
  REMINDER_MODE_LABELS,
} from '../../../core/services/notification.service';
import { WORKOUT_TYPE_OPTIONS } from '../../../core/constants/workout-types.constant';
import { SessionParticipantsEditorComponent } from '../../components/session-participants-editor/session-participants-editor.component';
import { SubscriptionModalComponent } from '../subscription-modal/subscription-modal.component';
import {
  normalizeParticipantsForIndividual,
  resolveIndividualMode,
  sanitizeParticipantsForApi,
  validateSessionParticipants,
} from '../../utils/session-participants.util';

@Component({
  selector: 'app-session-modal',
  imports: [CommonModule, IonicModule, SessionParticipantsEditorComponent],
  templateUrl: './session-modal.component.html',
  styleUrls: ['./session-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionModalComponent implements OnInit {
  // ─── Dependencies ──────────────────────────────────────────────
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly locationsService = inject(LocationsService);
  private readonly clientsService = inject(ClientsService);
  private readonly sessionsService = inject(SessionsService);
  private readonly subscriptionsService = inject(SubscriptionsService);
  private readonly notificationService = inject(NotificationService);

  // ─── Inputs ────────────────────────────────────────────────────
  @Input() locations: Location[] = [];
  @Input() clients: Client[] = [];
  @Input() session?: WorkoutSession;
  @Input() persistOnSubmit = false;
  @Input() preselectedDate?: string;
  @Input() preselectedClientId?: number;
  @Input() preselectedSubscriptionId?: number;

  // ─── Constants ─────────────────────────────────────────────────
  readonly WORKOUT_TYPE_OPTIONS = WORKOUT_TYPE_OPTIONS;
  readonly reminderModes = REMINDER_MODE_LABELS;
  readonly datetimeId = `datetime-${Math.random().toString(36).substring(2, 9)}`;

  // ─── State Signals ─────────────────────────────────────────────
  readonly locationList = signal<Location[]>([]);
  readonly clientList = signal<Client[]>([]);
  readonly isClientsLoading = signal<boolean>(false);

  readonly locationId = signal<number | null>(null);
  readonly type = signal<'INDIVIDUAL' | 'GROUP'>('INDIVIDUAL');
  readonly startTime = signal<string>(this.getLocalIsoString(new Date()));
  readonly duration = signal<number>(50);
  readonly price = signal<number>(300);
  readonly status = signal<'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'MISSED' | 'REQUIRED_ACTION'>('UPCOMING');
  readonly isPaid = signal<boolean>(false);
  readonly subscriptionId = signal<number | null>(null);
  readonly activeSubscriptions = signal<ClientSubscription[]>([]);
  readonly workoutTypes = signal<string[]>([]);
  readonly participants = signal<SessionParticipantDraft[]>([]);
  readonly anonymousParticipantsCount = signal<number>(1);
  readonly individualMode = signal<IndividualParticipantMode>('ANONYMOUS');

  readonly enableNotification = signal<boolean>(true);
  readonly reminderMode = signal<ReminderMode>('auto');
  readonly isCritical = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly isSubActionLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  private hasMutated = false;

  readonly minuteValues = computed<string>(() => (this.duration() === 30 ? '0,30' : '0'));

  readonly selectedIndividualClientId = computed<number | null>(() => {
    if (this.type() !== 'INDIVIDUAL' || this.individualMode() !== 'CLIENT') {
      return null;
    }
    return this.participants().find((p) => typeof p.clientId === 'number')?.clientId ?? null;
  });

  // ─── Lifecycle ─────────────────────────────────────────────────

  ngOnInit(): void {
    this.initLocations();
    this.initClients();

    if (this.session) {
      this.hydrateFromSession(this.session);
      return;
    }

    if (this.preselectedDate) {
      const targetDate = new Date(`${this.preselectedDate}T10:00:00`);
      if (!Number.isNaN(targetDate.getTime())) {
        this.startTime.set(this.getLocalIsoString(targetDate));
      }
    }

    if (this.preselectedClientId) {
      const found = this.clientList().find((c) => c.id === this.preselectedClientId);
      this.type.set('INDIVIDUAL');
      this.individualMode.set('CLIENT');
      this.anonymousParticipantsCount.set(0);
      this.participants.set([
        {
          clientId: this.preselectedClientId,
          client: found
            ? { id: found.id, fullName: found.fullName, phone: found.phone }
            : undefined,
        },
      ]);
      this.loadActiveSubscriptionsForClient(this.preselectedClientId);
    }

    if (this.preselectedSubscriptionId) {
      this.subscriptionId.set(this.preselectedSubscriptionId);
      this.price.set(0);
      this.isPaid.set(true);
    }
  }

  // ─── Public Methods ────────────────────────────────────────────

  cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(
      this.hasMutated ? { mutated: true } : null,
      'cancel',
    );
  }

  setType(nextType: 'INDIVIDUAL' | 'GROUP'): void {
    this.type.set(nextType);
    this.errorMessage.set(null);

    if (nextType === 'INDIVIDUAL') {
      const normalized = normalizeParticipantsForIndividual(this.participants());
      this.participants.set(normalized.participants);
      this.anonymousParticipantsCount.set(normalized.anonymousCount);
      this.individualMode.set(normalized.mode);
      const clientId = normalized.participants.find((p) => typeof p.clientId === 'number')?.clientId;
      if (clientId) {
        this.loadActiveSubscriptionsForClient(clientId);
      } else {
        this.activeSubscriptions.set([]);
      }
    } else {
      this.activeSubscriptions.set([]);
    }

    if (!this.subscriptionId()) {
      this.applyDefaultPriceFromLocation(this.locationId(), nextType);
    }
  }

  onLocationChange(rawId: unknown): void {
    const nextId = Number(rawId);
    this.locationId.set(Number.isFinite(nextId) && nextId > 0 ? nextId : null);
    this.errorMessage.set(null);

    if (!this.subscriptionId()) {
      this.applyDefaultPriceFromLocation(this.locationId(), this.type());
    }
  }

  onParticipantsChange(participants: SessionParticipantDraft[]): void {
    this.participants.set(participants);
    this.errorMessage.set(null);

    if (this.type() === 'INDIVIDUAL') {
      const clientId = participants.find((p) => typeof p.clientId === 'number')?.clientId;
      if (clientId) {
        this.loadActiveSubscriptionsForClient(clientId);
      } else {
        this.activeSubscriptions.set([]);
      }
    }
  }

  onAnonymousCountChange(count: number): void {
    this.anonymousParticipantsCount.set(Math.max(0, count));
    this.errorMessage.set(null);
  }

  onIndividualModeChange(mode: IndividualParticipantMode): void {
    this.individualMode.set(mode);
    this.errorMessage.set(null);
    if (mode !== 'CLIENT') {
      this.activeSubscriptions.set([]);
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

  onNotificationToggleChange(enabled: boolean): void {
    this.enableNotification.set(enabled);
    if (enabled) {
      void this.notificationService.ensureAccessForSessionCreation();
    }
  }

  async deductFromSubscription(subId: number): Promise<void> {
    if (!this.session || this.isSubActionLoading()) return;
    this.isSubActionLoading.set(true);
    this.errorMessage.set(null);

    try {
      await firstValueFrom(this.subscriptionsService.deductSession(subId, this.session.id));
      this.subscriptionId.set(subId);
      this.isPaid.set(true);
      this.price.set(0);
      this.activeSubscriptions.set([]);
      this.hasMutated = true;
      await this.showToast('Тренування списано з абонементу', 'success');
    } catch (err: unknown) {
      const errorObj = err as { error?: { message?: string } };
      this.errorMessage.set(errorObj?.error?.message || 'Помилка при списанні з абонементу');
    } finally {
      this.isSubActionLoading.set(false);
    }
  }

  async confirmUnlinkSubscription(): Promise<void> {
    const subId = this.subscriptionId();
    if (!this.session || !subId || this.isSubActionLoading()) return;

    const alert = await this.alertCtrl.create({
      header: 'Відмінити списання?',
      message: 'Заняття повернеться в абонемент, а тренування залишиться у розкладі.',
      buttons: [
        { text: 'Ні', role: 'cancel' },
        {
          text: 'Відмінити',
          role: 'destructive',
          handler: () => {
            void this.unlinkSubscription(subId);
          },
        },
      ],
    });
    await alert.present();
  }

  async quickCreateSubscription(): Promise<void> {
    const clientId = this.selectedIndividualClientId();
    if (!clientId) return;

    const modal = await this.modalCtrl.create({
      component: SubscriptionModalComponent,
      componentProps: { clientId },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || !data) return;

    this.isSubActionLoading.set(true);
    try {
      const created = await firstValueFrom(this.subscriptionsService.create(data));
      this.hasMutated = true;
      await this.showToast('Абонемент оформлено', 'success');

      if (this.session) {
        await this.deductFromSubscription(created.id);
      } else {
        this.subscriptionId.set(created.id);
        this.price.set(0);
        this.isPaid.set(true);
      }
    } catch (err: unknown) {
      const errorObj = err as { error?: { message?: string } };
      this.errorMessage.set(errorObj?.error?.message || 'Не вдалося створити абонемент');
    } finally {
      this.isSubActionLoading.set(false);
    }
  }

  async confirmDeleteSession(): Promise<void> {
    if (!this.session || this.isSubmitting()) return;

    const alert = await this.alertCtrl.create({
      header: 'Видалити тренування?',
      message: this.subscriptionId()
        ? 'Тренування буде видалено, а списане заняття автоматично повернеться в абонемент.'
        : 'Цю дію неможливо скасувати.',
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Видалити',
          role: 'destructive',
          handler: () => {
            void this.deleteCurrentSession();
          },
        },
      ],
    });
    await alert.present();
  }

  async confirm(): Promise<boolean | undefined> {
    if (this.isSubmitting() || !this.locationId()) {
      return undefined;
    }

    const sessionType = this.type();
    const anonymousCount = Math.max(0, Number(this.anonymousParticipantsCount()) || 0);
    const validationError = validateSessionParticipants(
      sessionType,
      this.individualMode(),
      this.participants(),
      anonymousCount,
    );
    if (validationError) {
      this.errorMessage.set(validationError);
      return undefined;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      if (this.enableNotification()) {
        await this.notificationService.ensureAccessForSessionCreation();
      }
    } catch {
      this.isSubmitting.set(false);
      return undefined;
    }

    const start = new Date(this.startTime());
    const end = new Date(start.getTime() + this.duration() * 60000);
    const resolvedLocationId = Number(this.locationId());

    if (!this.session) {
      this.locationsService.saveLastSelectedLocationId(resolvedLocationId);
    }

    const nextStatus = this.session ? this.status() : 'UPCOMING';
    const nextIsPaid =
      nextStatus === 'COMPLETED' ? true : this.session ? this.isPaid() : Boolean(this.subscriptionId());

    const payload = {
      locationId: resolvedLocationId,
      type: sessionType,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      price: +this.price(),
      status: nextStatus,
      isPaid: nextIsPaid,
      workoutTypes: this.workoutTypes(),
      participants: sanitizeParticipantsForApi(this.participants()),
      anonymousParticipantsCount: anonymousCount,
      enableNotification: this.enableNotification(),
      reminderMode: String(this.reminderMode()),
      isCritical: this.isCritical(),
    };

    if (!this.persistOnSubmit) {
      return this.modalCtrl.dismiss({ ...payload, mutated: this.hasMutated }, 'confirm');
    }

    try {
      let savedSession: WorkoutSession;
      if (this.session) {
        savedSession = await firstValueFrom(this.sessionsService.update(this.session.id, payload));
      } else {
        savedSession = await firstValueFrom(this.sessionsService.create(payload));
        const targetSubId = this.subscriptionId();
        if (targetSubId) {
          await firstValueFrom(
            this.subscriptionsService.deductSession(targetSubId, savedSession.id),
          );
        }
      }

      if (payload.enableNotification) {
        const loc = this.locationList().find((l) => l.id === resolvedLocationId);
        if (loc) {
          await this.notificationService.scheduleForSession(
            { id: savedSession.id, startTime: payload.startTime, locationId: resolvedLocationId },
            loc.name,
            this.reminderMode(),
          );
        }
      } else {
        await this.notificationService.cancelForSession(savedSession.id);
      }

      await this.showToast(
        this.session ? 'Зміни збережено' : 'Тренування створено',
        'success',
      );
      return this.modalCtrl.dismiss({ session: savedSession, mutated: true }, 'confirm');
    } catch (err: unknown) {
      this.isSubmitting.set(false);
      const errorObj = err as { error?: { message?: string } };
      this.errorMessage.set(
        errorObj?.error?.message ||
          (this.session ? 'Не вдалося оновити тренування' : 'Не вдалося створити тренування'),
      );
      return undefined;
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────

  private async unlinkSubscription(subId: number): Promise<void> {
    if (!this.session) return;
    this.isSubActionLoading.set(true);
    this.errorMessage.set(null);

    try {
      await firstValueFrom(this.subscriptionsService.unlinkSession(subId, this.session.id));
      this.subscriptionId.set(null);
      this.isPaid.set(false);
      this.hasMutated = true;
      const clientId = this.selectedIndividualClientId();
      if (clientId) {
        this.loadActiveSubscriptionsForClient(clientId);
      }
      await this.showToast('Списання скасовано, заняття повернуто в абонемент', 'success');
    } catch (err: unknown) {
      const errorObj = err as { error?: { message?: string } };
      this.errorMessage.set(errorObj?.error?.message || 'Помилка при скасуванні списання');
    } finally {
      this.isSubActionLoading.set(false);
    }
  }

  private async deleteCurrentSession(): Promise<void> {
    if (!this.session) return;
    this.isSubmitting.set(true);

    try {
      await firstValueFrom(this.sessionsService.delete(this.session.id));
      await this.notificationService.cancelForSession(this.session.id);
      await this.showToast('Тренування видалено', 'medium');
      await this.modalCtrl.dismiss({ deleted: true, sessionId: this.session.id, mutated: true }, 'delete');
    } catch (err: unknown) {
      this.isSubmitting.set(false);
      const errorObj = err as { error?: { message?: string } };
      this.errorMessage.set(errorObj?.error?.message || 'Не вдалося видалити тренування');
    }
  }

  private initLocations(): void {
    if (this.locations && this.locations.length > 0) {
      this.locationList.set(this.locations);
      if (!this.session) {
        const defaultId = this.locationsService.resolveDefaultLocationId(this.locations);
        this.locationId.set(defaultId);
        if (!this.preselectedSubscriptionId) {
          this.applyDefaultPriceFromLocation(defaultId, this.type());
        }
      }
      return;
    }

    this.locationsService.getAll().subscribe({
      next: (locs) => {
        const list = locs || [];
        this.locationList.set(list);
        if (!this.session) {
          const defaultId = this.locationsService.resolveDefaultLocationId(list);
          this.locationId.set(defaultId);
          if (!this.preselectedSubscriptionId) {
            this.applyDefaultPriceFromLocation(defaultId, this.type());
          }
        }
      },
    });
  }

  private initClients(): void {
    if (this.clients && this.clients.length > 0) {
      this.clientList.set(this.clients);
      return;
    }
    this.loadClients();
  }

  private hydrateFromSession(session: WorkoutSession): void {
    this.locationId.set(session.locationId);
    this.type.set(session.type);
    this.startTime.set(this.getLocalIsoString(new Date(session.startTime)));
    this.price.set(session.price);
    this.status.set(session.status);
    this.isPaid.set(Boolean(session.isPaid));
    this.subscriptionId.set(session.subscriptionId ?? null);

    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    this.duration.set(Math.round((end.getTime() - start.getTime()) / 60000));

    if (session.workoutTypes) {
      this.workoutTypes.set([...session.workoutTypes]);
    }

    const existingParticipants: SessionParticipantDraft[] = (session.participants || []).map((p) => ({
      clientId: p.clientId,
      customName: p.customName,
      client: p.client,
    }));
    const existingAnonymous = Math.max(0, session.anonymousParticipantsCount ?? 0);

    this.participants.set(existingParticipants);
    this.anonymousParticipantsCount.set(existingAnonymous);

    if (session.type === 'INDIVIDUAL') {
      const mode = resolveIndividualMode(existingParticipants);
      this.individualMode.set(mode);
      if (mode === 'ANONYMOUS' && existingAnonymous === 0) {
        this.anonymousParticipantsCount.set(1);
      }

      const clientId = existingParticipants.find((p) => typeof p.clientId === 'number')?.clientId;
      if (clientId && !session.subscriptionId) {
        this.loadActiveSubscriptionsForClient(clientId);
      }
    }

    if (session.enableNotification !== undefined) {
      this.enableNotification.set(session.enableNotification);
    }
    if (session.reminderMode) {
      this.reminderMode.set(String(session.reminderMode) as ReminderMode);
    }
    if (session.isCritical !== undefined) {
      this.isCritical.set(session.isCritical);
    }
  }

  private loadActiveSubscriptionsForClient(clientId: number): void {
    this.subscriptionsService.getActiveForClient(clientId).subscribe({
      next: (subs) => this.activeSubscriptions.set(subs || []),
      error: () => this.activeSubscriptions.set([]),
    });
  }

  private applyDefaultPriceFromLocation(
    locationId: number | null,
    sessionType: 'INDIVIDUAL' | 'GROUP',
  ): void {
    if (!locationId) return;
    const loc = this.locationList().find((l) => l.id === Number(locationId));
    const defaultPrice = this.locationsService.resolveDefaultPrice(loc, sessionType);
    if (defaultPrice !== null) {
      this.price.set(defaultPrice);
    }
  }

  private getLocalIsoString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
