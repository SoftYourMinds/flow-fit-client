import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController, ModalController, ActionSheetController, ToastController, AlertController, IonItemSliding } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { SessionsService, WorkoutSession } from '../../../core/services/sessions.service';
import { SubscriptionsService, ClientSubscription } from '../../../core/services/subscriptions.service';
import { SessionModalComponent } from '../../../shared/modals/session-modal/session-modal.component';
import { ParticipantModalComponent } from '../../../shared/modals/participant-modal/participant-modal.component';
import { ClientsService, Client } from '../../../core/services/clients.service';
import { LocationsService, Location } from '../../../core/services/locations.service';
import { NotificationService, ReminderMode, REMINDER_MODE_LABELS } from '../../../core/services/notification.service';
import { LocalNotifications } from '@capacitor/local-notifications';

@Component({
  selector: 'app-session-detail',
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './session-detail.component.html',
  styleUrls: ['./session-detail.component.scss']
})
export class SessionDetailComponent implements OnInit {
  // ─── Injected Dependencies ─────────────────────────────────────
  private readonly route = inject(ActivatedRoute);
  private readonly navCtrl = inject(NavController);
  private readonly sessionsService = inject(SessionsService);
  private readonly clientsService = inject(ClientsService);
  private readonly locationsService = inject(LocationsService);
  private readonly modalCtrl = inject(ModalController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly notificationService = inject(NotificationService);
  private readonly subscriptionsService = inject(SubscriptionsService);

  // ─── State Signals ─────────────────────────────────────────────
  session = signal<WorkoutSession | null>(null);
  isLoading = signal(true);
  clients = signal<Client[]>([]);
  locations = signal<Location[]>([]);
  activeSubscriptions = signal<ClientSubscription[]>([]);

  // Notification state
  notificationEnabled = false;
  reminderMode: ReminderMode = 'auto';
  reminderModes = REMINDER_MODE_LABELS;

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
        this.loadActiveSubscriptions(data);
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
    // If setting to COMPLETED, also ensure isPaid is true on the backend.
    const payload: any = { status };
    if (status === 'COMPLETED') {
      payload.isPaid = true;
    }
    this.sessionsService.update(id, payload).subscribe(() => this.loadSession(id));
  }

  toggleIsPaid(event: any) {
    const s = this.session();
    if (!s) return;
    const isPaid = event.detail.checked;
    this.sessionsService.update(s.id, { isPaid }).subscribe(() => this.loadSession(s.id));
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

  deductFromSubscription(subscriptionId: number): void {
    const s = this.session();
    if (!s) return;

    this.subscriptionsService.deductSession(subscriptionId, s.id).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: 'Тренування успішно списано з абонементу!',
          duration: 2500,
          color: 'success',
          position: 'bottom',
        });
        await toast.present();
        this.loadSession(s.id);
      },
      error: async (err) => {
        const toast = await this.toastCtrl.create({
          message: err?.error?.message || 'Помилка при списанні з абонементу',
          duration: 3000,
          color: 'danger',
          position: 'bottom',
        });
        await toast.present();
      },
    });
  }

  async openSubscriptionActions(slidingItem?: IonItemSliding): Promise<void> {
    const s = this.session();
    if (!s || !s.subscriptionId) return;

    const actionSheet = await this.actionSheetCtrl.create({
      header: `Абонемент #${s.subscriptionId}`,
      subHeader: 'Управління списанням за цим тренуванням',
      buttons: [
        {
          text: 'Відмінити списання з абонементу',
          role: 'destructive',
          icon: 'arrow-undo-outline',
          handler: () => {
            this.confirmUnlinkSubscription(slidingItem);
          },
        },
        {
          text: 'Закрити',
          role: 'cancel',
          icon: 'close',
        },
      ],
    });

    await actionSheet.present();
  }

  async confirmUnlinkSubscription(slidingItem?: IonItemSliding): Promise<void> {
    if (slidingItem) {
      await slidingItem.close();
    }

    const s = this.session();
    if (!s || !s.subscriptionId) return;

    const alert = await this.alertCtrl.create({
      header: 'Відмінити списання?',
      message: 'Заняття буде повернуто в абонемент, а це тренування залишиться у розкладі як неоплачене.',
      buttons: [
        {
          text: 'Ні',
          role: 'cancel',
        },
        {
          text: 'Відмінити списання',
          role: 'destructive',
          handler: () => this.unlinkFromSubscription(s.subscriptionId!, s.id),
        },
      ],
    });

    await alert.present();
  }

  private unlinkFromSubscription(subscriptionId: number, sessionId: number): void {
    this.subscriptionsService.unlinkSession(subscriptionId, sessionId).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: 'Списання успішно скасовано! Заняття повернуто в абонемент.',
          duration: 2500,
          color: 'success',
          position: 'bottom',
        });
        await toast.present();
        this.loadSession(sessionId);
      },
      error: async (err) => {
        const toast = await this.toastCtrl.create({
          message: err?.error?.message || 'Помилка при скасуванні списання з абонементу',
          duration: 3000,
          color: 'danger',
          position: 'bottom',
        });
        await toast.present();
      },
    });
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private loadActiveSubscriptions(session: WorkoutSession): void {
    const isIndividual = session.type === 'INDIVIDUAL';
    const alreadyDeducted = !!(session as any).subscriptionId;
    if (!isIndividual || alreadyDeducted) {
      this.activeSubscriptions.set([]);
      return;
    }

    const clientIds = session.participants
      .filter(p => p.clientId)
      .map(p => p.clientId as number);

    if (clientIds.length === 0) {
      this.activeSubscriptions.set([]);
      return;
    }

    // Load active subs for the first client participant
    this.subscriptionsService.getActiveForClient(clientIds[0]).subscribe({
      next: (subs) => this.activeSubscriptions.set(subs),
      error: () => this.activeSubscriptions.set([]),
    });
  }
}
