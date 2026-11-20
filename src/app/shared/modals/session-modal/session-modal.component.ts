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
import { IonicModule, ModalController } from '@ionic/angular';

import { LocationsService, Location } from '../../../core/services/locations.service';
import { ClientsService, Client } from '../../../core/services/clients.service';
import {
  IndividualParticipantMode,
  SessionParticipantDraft,
  WorkoutSession,
} from '../../../core/services/sessions.service';
import {
  NotificationService,
  ReminderMode,
  REMINDER_MODE_LABELS,
} from '../../../core/services/notification.service';
import { WORKOUT_TYPE_OPTIONS } from '../../../core/constants/workout-types.constant';
import { SessionParticipantsEditorComponent } from '../../components/session-participants-editor/session-participants-editor.component';
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
  private readonly locationsService = inject(LocationsService);
  private readonly clientsService = inject(ClientsService);
  private readonly notificationService = inject(NotificationService);

  // ─── Inputs ────────────────────────────────────────────────────
  @Input() locations: Location[] = [];
  @Input() clients: Client[] = [];
  @Input() session?: WorkoutSession;

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
  readonly workoutTypes = signal<string[]>([]);
  readonly participants = signal<SessionParticipantDraft[]>([]);
  readonly anonymousParticipantsCount = signal<number>(1);
  readonly individualMode = signal<IndividualParticipantMode>('ANONYMOUS');

  readonly enableNotification = signal<boolean>(true);
  readonly reminderMode = signal<ReminderMode>('auto');
  readonly isCritical = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly minuteValues = computed<string>(() => (this.duration() === 30 ? '0,30' : '0'));

  // ─── Lifecycle ─────────────────────────────────────────────────

  ngOnInit(): void {
    this.initLocations();
    this.initClients();

    if (this.session) {
      this.hydrateFromSession(this.session);
    }
  }

  // ─── Public Methods ────────────────────────────────────────────

  cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  setType(nextType: 'INDIVIDUAL' | 'GROUP'): void {
    this.type.set(nextType);
    this.errorMessage.set(null);

    if (nextType === 'INDIVIDUAL') {
      const normalized = normalizeParticipantsForIndividual(this.participants());
      this.participants.set(normalized.participants);
      this.anonymousParticipantsCount.set(normalized.anonymousCount);
      this.individualMode.set(normalized.mode);
    }
  }

  onParticipantsChange(participants: SessionParticipantDraft[]): void {
    this.participants.set(participants);
    this.errorMessage.set(null);
  }

  onAnonymousCountChange(count: number): void {
    this.anonymousParticipantsCount.set(Math.max(0, count));
    this.errorMessage.set(null);
  }

  onIndividualModeChange(mode: IndividualParticipantMode): void {
    this.individualMode.set(mode);
    this.errorMessage.set(null);
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

    return this.modalCtrl.dismiss(
      {
        locationId: resolvedLocationId,
        type: sessionType,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        price: +this.price(),
        status: this.session ? this.session.status : 'UPCOMING',
        isPaid: this.session ? this.session.isPaid : false,
        workoutTypes: this.workoutTypes(),
        participants: sanitizeParticipantsForApi(this.participants()),
        anonymousParticipantsCount: anonymousCount,
        enableNotification: this.enableNotification(),
        reminderMode: String(this.reminderMode()),
        isCritical: this.isCritical(),
      },
      'confirm',
    );
  }

  // ─── Private Helpers ───────────────────────────────────────────

  private initLocations(): void {
    if (this.locations && this.locations.length > 0) {
      this.locationList.set(this.locations);
      if (!this.session) {
        this.locationId.set(this.locationsService.resolveDefaultLocationId(this.locations));
      }
      return;
    }

    this.locationsService.getAll().subscribe({
      next: (locs) => {
        this.locationList.set(locs || []);
        if (!this.session) {
          this.locationId.set(this.locationsService.resolveDefaultLocationId(locs || []));
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

  private getLocalIsoString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
  }
}
