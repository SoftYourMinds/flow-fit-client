import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ModalController, ActionSheetController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { SessionsService, WorkoutSession } from '../../../core/services/sessions.service';
import { SessionModalComponent } from '../../../shared/modals/session-modal/session-modal.component';
import { ParticipantModalComponent } from '../../../shared/modals/participant-modal/participant-modal.component';
import { ClientsService, Client } from '../../../core/services/clients.service';
import { LocationsService, Location } from '../../../core/services/locations.service';
import { NotificationService, ReminderMode, REMINDER_MODE_LABELS } from '../../../core/services/notification.service';
import { LocalNotifications } from '@capacitor/local-notifications';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './session-detail.component.html',
  styleUrls: ['./session-detail.component.scss']
})
export class SessionDetailComponent implements OnInit {
  session = signal<WorkoutSession | null>(null);
  isLoading = signal(true);
  clients = signal<Client[]>([]);
  locations = signal<Location[]>([]);

  // Notification state
  notificationEnabled = false;
  reminderMode: ReminderMode = 'auto';
  reminderModes = REMINDER_MODE_LABELS;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private sessionsService: SessionsService,
    private clientsService: ClientsService,
    private locationsService: LocationsService,
    private modalCtrl: ModalController,
    private actionSheetCtrl: ActionSheetController,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        this.loadSession(+idParam);
      }
    });
    
    // Load lists for modals
    this.clientsService.getAll().subscribe({
      next: (cls) => this.clients.set(cls)
    });
    this.locationsService.getAll().subscribe({
      next: (locs) => this.locations.set(locs)
    });
  }

  loadSession(id: number) {
    this.isLoading.set(true);
    this.sessionsService.getById(id).subscribe({
      next: (data) => {
        this.session.set(data);
        this.checkNotificationState(data.id);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.goBack();
      }
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  async editSession() {
    const s = this.session();
    if (!s) return;

    const modal = await this.modalCtrl.create({
      component: SessionModalComponent,
      componentProps: {
        locations: this.locations(),
        clients: this.clients(),
        session: s
      }
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      const enableNotification = data.enableNotification;
      const reminderMode = data.reminderMode;

      delete data.participants; // Edit of participants is done via detail page directly
      delete data.enableNotification;
      delete data.reminderMode;
      
      this.sessionsService.update(s.id, data).subscribe(() => {
        if (enableNotification) {
          const loc = this.locations().find(l => l.id === data.locationId);
          if (loc) {
            // Re-schedule (the service automatically cancels the old one first)
            this.notificationService.scheduleForSession(
              { id: s.id, startTime: data.startTime, locationId: data.locationId }, 
              loc.name, 
              reminderMode
            );
          }
        } else {
          this.notificationService.cancelForSession(s.id);
        }
        
        this.loadSession(s.id);
      });
    }
  }

  async openAddParticipantModal() {
    const s = this.session();
    if (!s) return;

    const modal = await this.modalCtrl.create({
      component: ParticipantModalComponent,
      componentProps: {
        clients: this.clients()
      }
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.sessionsService.addParticipant(s.id, data).subscribe(() => this.loadSession(s.id));
    }
  }

  removeParticipant(participantId: number) {
    const s = this.session();
    if (!s) return;
    this.sessionsService.removeParticipant(s.id, participantId).subscribe(() => this.loadSession(s.id));
  }

  async openSessionActions() {
    const s = this.session();
    if (!s) return;

    const actionSheet = await this.actionSheetCtrl.create({
      header: `Управління заняттям #${s.id}`,
      buttons: [
        {
          text: 'Позначити як ACTIVE',
          icon: 'play-outline',
          handler: () => this.updateStatus(s.id, 'ACTIVE')
        },
        {
          text: 'Позначити як COMPLETED',
          icon: 'checkmark-circle-outline',
          handler: () => this.updateStatus(s.id, 'COMPLETED')
        },
        {
          text: 'Позначити як MISSED',
          icon: 'close-circle-outline',
          handler: () => this.updateStatus(s.id, 'MISSED')
        },
        {
          text: 'Видалити заняття',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => this.deleteSession(s.id)
        },
        {
          text: 'Скасувати',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  updateStatus(id: number, status: any) {
    this.sessionsService.update(id, { status }).subscribe(() => this.loadSession(id));
  }

  deleteSession(id: number) {
    this.sessionsService.delete(id).subscribe(() => {
      this.notificationService.cancelForSession(id);
      this.goBack();
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'UPCOMING': return 'primary';
      case 'ACTIVE': return 'warning';
      case 'COMPLETED': return 'success';
      case 'MISSED': return 'danger';
      case 'REQUIRED_ACTION': return 'tertiary';
      default: return 'medium';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'UPCOMING': return 'Заплановано';
      case 'ACTIVE': return 'Триває';
      case 'COMPLETED': return 'Завершено';
      case 'MISSED': return 'Пропущено';
      case 'REQUIRED_ACTION': return 'Потребує дії';
      default: return status;
    }
  }

  async checkNotificationState(sessionId: number) {
    if (!this.notificationService.isNative()) return;
    try {
      const pending = await LocalNotifications.getPending();
      const exists = pending.notifications.some(n => n.id === sessionId);
      this.notificationEnabled = exists;
    } catch {
      this.notificationEnabled = false;
    }
  }

  async updateNotification() {
    const s = this.session();
    if (!s) return;

    if (this.notificationEnabled) {
      const loc = this.locations().find(l => l.id === s.locationId);
      const locName = loc ? loc.name : `Локація #${s.locationId}`;
      await this.notificationService.scheduleForSession(
        { id: s.id, startTime: s.startTime, locationId: s.locationId },
        locName,
        this.reminderMode
      );
    } else {
      await this.notificationService.cancelForSession(s.id);
    }
  }
}
