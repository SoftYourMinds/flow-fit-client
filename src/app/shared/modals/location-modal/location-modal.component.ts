import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

import { Location } from '../../../core/services/locations.service';

@Component({
  selector: 'app-location-modal',
  imports: [CommonModule, IonicModule],
  templateUrl: './location-modal.component.html',
  styleUrls: ['./location-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationModalComponent implements OnInit {
  private readonly modalCtrl = inject(ModalController);

  @Input() location?: Location;

  readonly name = signal<string>('');
  readonly address = signal<string>('');
  readonly type = signal<'STUDIO' | 'GYM' | 'OUTDOOR'>('STUDIO');
  readonly maxParticipants = signal<number>(8);

  // ─── Lifecycle ─────────────────────────────────────────────────

  ngOnInit(): void {
    if (!this.location) {
      return;
    }

    this.name.set(this.location.name || '');
    this.address.set(this.location.address || '');
    this.type.set(this.location.type || 'STUDIO');
    this.maxParticipants.set(this.location.maxParticipants ?? 8);
  }

  // ─── Public Methods ────────────────────────────────────────────

  onMaxParticipantsInput(rawValue: unknown): void {
    const parsed = Number(rawValue);
    const isValid = Number.isFinite(parsed) && parsed >= 1;
    this.maxParticipants.set(isValid ? Math.floor(parsed) : 1);
  }

  cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm(): Promise<boolean> | undefined {
    const trimmedName = this.name().trim();
    if (!trimmedName) {
      return undefined;
    }

    const capacity = Math.max(1, Math.floor(Number(this.maxParticipants()) || 8));

    return this.modalCtrl.dismiss(
      {
        name: trimmedName,
        address: this.address().trim(),
        type: this.type(),
        maxParticipants: capacity,
      },
      'confirm',
    );
  }
}
