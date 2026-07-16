import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { LocationsService, Location } from '../../../core/services/locations.service';
import { ClientsService, Client } from '../../../core/services/clients.service';
import { ParticipantModalComponent } from '../participant-modal/participant-modal.component';
import { ReminderMode, REMINDER_MODE_LABELS } from '../../../core/services/notification.service';

@Component({
  selector: 'app-session-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './session-modal.component.html',
  styleUrls: ['./session-modal.component.scss']
})
export class SessionModalComponent implements OnInit {
  @Input() locations: Location[] = [];
  @Input() clients: Client[] = [];

  @Input() session?: any; // To edit an existing session

  locationId: number | null = null;
  type: 'INDIVIDUAL' | 'GROUP' = 'INDIVIDUAL';
  startTime: string = this.getLocalIsoString(new Date());
  duration: number = 50;
  price: number = 300;
  participants: any[] = [];

  // Notifications
  enableNotification: boolean = true;
  reminderMode: ReminderMode = 'auto';
  reminderModes = REMINDER_MODE_LABELS;

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
            this.locationId = locs[0].id;
          }
        }
      });
    } else if (this.locations.length > 0 && !this.session) {
      this.locationId = this.locations[0].id;
    }

    if (this.session) {
      this.locationId = this.session.locationId;
      this.type = this.session.type;
      this.startTime = this.getLocalIsoString(new Date(this.session.startTime));
      this.price = this.session.price;
      
      const start = new Date(this.session.startTime);
      const end = new Date(this.session.endTime);
      this.duration = Math.round((end.getTime() - start.getTime()) / 60000);
      
      this.participants = this.session.participants ? [...this.session.participants] : [];
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
      this.participants.push(data);
    }
  }

  removeParticipant(index: number) {
    this.participants.splice(index, 1);
  }

  confirm() {
    if (!this.locationId) return;
    
    // Розрахунок часу завершення
    const start = new Date(this.startTime);
    const end = new Date(start.getTime() + this.duration * 60000);

    return this.modalCtrl.dismiss({
      locationId: +this.locationId,
      type: this.type,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      price: +this.price,
      status: this.session ? this.session.status : 'UPCOMING',
      isPaid: this.session ? this.session.isPaid : false,
      participants: this.participants,
      enableNotification: this.enableNotification,
      reminderMode: this.reminderMode
    }, 'confirm');
  }

  private getLocalIsoString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
  }
}
