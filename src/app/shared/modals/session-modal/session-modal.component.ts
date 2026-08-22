import { Component, OnInit, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { LocationsService, Location } from '../../../core/services/locations.service';
import { ClientsService, Client } from '../../../core/services/clients.service';
import { ParticipantModalComponent } from '../participant-modal/participant-modal.component';
import { ReminderMode, REMINDER_MODE_LABELS } from '../../../core/services/notification.service';

@Component({
  selector: 'app-session-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './session-modal.component.html',
  styleUrls: ['./session-modal.component.scss']
})
export class SessionModalComponent implements OnInit {
  @Input() locations: Location[] = [];
  @Input() clients: Client[] = [];

  @Input() session?: any; // To edit an existing session

  locationId = signal<number | null>(null);
  type = signal<'INDIVIDUAL' | 'GROUP'>('INDIVIDUAL');
  startTime = signal<string>(this.getLocalIsoString(new Date()));
  duration = signal<number>(50);
  price = signal<number>(300);
  maxParticipants = signal<number | null>(null);
  workoutTypes = signal<string[]>([]);
  participants = signal<any[]>([]);

  readonly WORKOUT_TYPE_OPTIONS = [
    'stretching',
    'fly stretching',
    'yoga',
    'functional',
    'pilates',
    'power pilates'
  ];

  datetimeId = `datetime-${Math.random().toString(36).substring(2, 9)}`;

  // Notifications
  enableNotification = signal<boolean>(true);
  reminderMode = signal<ReminderMode>('auto');
  reminderModes = REMINDER_MODE_LABELS;

  minuteValues = computed(() => {
    return this.duration() === 30 ? '0,30' : '0';
  });

  constructor(
    private modalCtrl: ModalController,
    private locationsService: LocationsService
  ) {}

  ngOnInit() {
    if (!this.locations || this.locations.length === 0) {
      this.locationsService.getAll().subscribe({
        next: (locs) => {
          this.locations = locs;
          if (locs.length > 0 && !this.session) {
            this.locationId.set(locs[0].id);
          }
        }
      });
    } else if (this.locations.length > 0 && !this.session) {
      this.locationId.set(this.locations[0].id);
    }

    if (this.session) {
      this.locationId.set(this.session.locationId);
      this.type.set(this.session.type);
      this.startTime.set(this.getLocalIsoString(new Date(this.session.startTime)));
      this.price.set(this.session.price);
      this.maxParticipants.set(this.session.maxParticipants ?? null);
      
      const start = new Date(this.session.startTime);
      const end = new Date(this.session.endTime);
      this.duration.set(Math.round((end.getTime() - start.getTime()) / 60000));
      
      if (this.session.workoutTypes) {
        this.workoutTypes.set([...this.session.workoutTypes]);
      }
      
      this.participants.set(this.session.participants ? [...this.session.participants] : []);
    }
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  async openAddParticipantModal() {
    const modal = await this.modalCtrl.create({
      component: ParticipantModalComponent,
      componentProps: {
        clients: this.clients
      }
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      if (data.clientId) {
        data.client = this.clients.find(c => c.id === data.clientId);
      }
      this.participants.update(p => [...p, data]);
    }
  }

  removeParticipant(index: number) {
    this.participants.update(p => p.filter((_, i) => i !== index));
  }

  confirm() {
    if (!this.locationId()) return;
    
    // Розрахунок часу завершення
    const start = new Date(this.startTime());
    const end = new Date(start.getTime() + this.duration() * 60000);

    return this.modalCtrl.dismiss({
      locationId: Number(this.locationId()),
      type: this.type(),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      price: +this.price(),
      maxParticipants: this.maxParticipants() ? Number(this.maxParticipants()) : null,
      status: this.session ? this.session.status : 'UPCOMING',
      isPaid: this.session ? this.session.isPaid : false,
      workoutTypes: this.workoutTypes(),
      participants: this.participants(),
      enableNotification: this.enableNotification(),
      reminderMode: this.reminderMode()
    }, 'confirm');
  }

  private getLocalIsoString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
  }
}
