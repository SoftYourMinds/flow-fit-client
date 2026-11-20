import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { Client } from '../../../core/services/clients.service';
import {
  IndividualParticipantMode,
  SessionParticipantDraft,
} from '../../../core/services/sessions.service';

@Component({
  selector: 'app-session-participants-editor',
  imports: [CommonModule, IonicModule],
  templateUrl: './session-participants-editor.component.html',
  styleUrls: ['./session-participants-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionParticipantsEditorComponent {
  // ─── Inputs & Outputs ──────────────────────────────────────────
  readonly sessionType = input.required<'INDIVIDUAL' | 'GROUP'>();
  readonly clients = input<Client[]>([]);
  readonly isClientsLoading = input<boolean>(false);
  readonly participants = input<SessionParticipantDraft[]>([]);
  readonly anonymousCount = input<number>(0);
  readonly individualMode = input<IndividualParticipantMode>('ANONYMOUS');

  readonly participantsChange = output<SessionParticipantDraft[]>();
  readonly anonymousCountChange = output<number>();
  readonly individualModeChange = output<IndividualParticipantMode>();
  readonly refreshClients = output<void>();

  // ─── Local State & Derived Signals ─────────────────────────────
  protected readonly newCustomName = signal<string>('');

  protected readonly totalCount = computed<number>(
    () => this.participants().length + Math.max(0, this.anonymousCount()),
  );

  protected readonly selectedClientIds = computed<number[]>(() =>
    this.participants()
      .map((p) => p.clientId)
      .filter((id): id is number => typeof id === 'number' && id > 0),
  );

  protected readonly selectedIndividualClientId = computed<number | null>(
    () => this.participants().find((p) => typeof p.clientId === 'number')?.clientId ?? null,
  );

  protected readonly individualCustomName = computed<string>(
    () => this.participants().find((p) => !p.clientId && p.customName !== undefined)?.customName ?? '',
  );

  protected readonly selectedClientParticipants = computed<SessionParticipantDraft[]>(() =>
    this.participants().filter((p) => typeof p.clientId === 'number'),
  );

  protected readonly customParticipants = computed<SessionParticipantDraft[]>(() =>
    this.participants().filter((p) => !p.clientId && Boolean(p.customName?.trim())),
  );

  // ─── Public Methods (INDIVIDUAL) ───────────────────────────────

  protected onIndividualModeChange(rawValue: unknown): void {
    const mode = rawValue as IndividualParticipantMode;
    this.individualModeChange.emit(mode);

    if (mode === 'ANONYMOUS') {
      this.anonymousCountChange.emit(1);
      this.participantsChange.emit([]);
      return;
    }

    this.anonymousCountChange.emit(0);

    if (mode === 'CLIENT') {
      const existingClient = this.participants().find((p) => typeof p.clientId === 'number');
      this.participantsChange.emit(existingClient ? [existingClient] : []);
      return;
    }

    const existingCustom = this.participants().find((p) => !p.clientId && Boolean(p.customName));
    this.participantsChange.emit(existingCustom ? [existingCustom] : []);
  }

  protected onIndividualClientChange(rawValue: unknown): void {
    const id = Number(rawValue);
    this.anonymousCountChange.emit(0);

    if (!Number.isInteger(id) || id <= 0) {
      this.participantsChange.emit([]);
      return;
    }

    this.participantsChange.emit([this.buildClientDraft(id)]);
  }

  protected onIndividualCustomNameInput(rawValue: unknown): void {
    const value = String(rawValue ?? '');
    this.anonymousCountChange.emit(0);

    if (value.trim().length === 0) {
      this.participantsChange.emit([]);
      return;
    }

    this.participantsChange.emit([{ customName: value }]);
  }

  // ─── Public Methods (GROUP) ────────────────────────────────────

  protected decrementAnonymous(): void {
    const next = Math.max(0, this.anonymousCount() - 1);
    this.anonymousCountChange.emit(next);
  }

  protected incrementAnonymous(): void {
    const next = Math.max(0, this.anonymousCount()) + 1;
    this.anonymousCountChange.emit(next);
  }

  protected onAnonymousCountInput(rawValue: unknown): void {
    const parsed = Number(rawValue);
    const isValid = Number.isFinite(parsed) && parsed >= 0;
    this.anonymousCountChange.emit(isValid ? Math.floor(parsed) : 0);
  }

  protected onGroupClientsChange(rawValue: unknown): void {
    const rawIds = Array.isArray(rawValue) ? rawValue : [];
    const clientIds = rawIds
      .map((val) => Number(val))
      .filter((id) => Number.isInteger(id) && id > 0);

    const clientDrafts = clientIds.map((id) => this.buildClientDraft(id));
    const existingCustoms = this.participants().filter((p) => !p.clientId && Boolean(p.customName?.trim()));
    this.participantsChange.emit([...clientDrafts, ...existingCustoms]);
  }

  protected onNewCustomNameInput(rawValue: unknown): void {
    this.newCustomName.set(String(rawValue ?? ''));
  }

  protected addCustomParticipant(): void {
    const trimmed = this.newCustomName().trim();
    if (!trimmed) {
      return;
    }

    this.participantsChange.emit([...this.participants(), { customName: trimmed }]);
    this.newCustomName.set('');
  }

  protected removeClientParticipant(clientId?: number): void {
    if (!clientId) {
      return;
    }

    this.participantsChange.emit(this.participants().filter((p) => p.clientId !== clientId));
  }

  protected removeCustomParticipant(customIndex: number): void {
    let seenCustom = 0;
    const updated = this.participants().filter((p) => {
      const isCustom = !p.clientId && Boolean(p.customName?.trim());
      if (!isCustom) {
        return true;
      }
      const shouldKeep = seenCustom !== customIndex;
      seenCustom += 1;
      return shouldKeep;
    });

    this.participantsChange.emit(updated);
  }

  protected getClientDisplayName(participant: SessionParticipantDraft): string {
    if (participant.client?.fullName) {
      return participant.client.fullName;
    }
    const found = this.clients().find((c) => c.id === participant.clientId);
    return found?.fullName || `Клієнт #${participant.clientId}`;
  }

  protected onRefreshClients(): void {
    this.refreshClients.emit();
  }

  // ─── Private Helpers ───────────────────────────────────────────

  private buildClientDraft(clientId: number): SessionParticipantDraft {
    const fromClients = this.clients().find((c) => c.id === clientId);
    if (fromClients) {
      return {
        clientId,
        client: {
          id: fromClients.id,
          fullName: fromClients.fullName,
          phone: fromClients.phone,
        },
      };
    }

    const fromExisting = this.participants().find((p) => p.clientId === clientId);
    return {
      clientId,
      client: fromExisting?.client,
    };
  }
}
