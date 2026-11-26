import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonicModule,
  ModalController,
  ToastController,
  AlertController,
  ActionSheetController,
  ViewWillEnter,
} from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ClientsService } from '../../../core/services/clients.service';
import { SubscriptionsService, ClientSubscription } from '../../../core/services/subscriptions.service';
import { LocationsService } from '../../../core/services/locations.service';
import { SessionsService } from '../../../core/services/sessions.service';
import { NotificationService } from '../../../core/services/notification.service';
import { NoteModalComponent } from '../../../shared/modals/note-modal/note-modal.component';
import { MediaViewerModalComponent } from '../../../shared/modals/media-viewer-modal/media-viewer-modal.component';
import { SubscriptionModalComponent } from '../../../shared/modals/subscription-modal/subscription-modal.component';
import { RecurringModalComponent } from '../../../shared/modals/recurring-modal/recurring-modal.component';
import { SubscriptionDetailModalComponent } from '../../../shared/modals/subscription-detail-modal/subscription-detail-modal.component';
import { ClientModalComponent } from '../../../shared/modals/client-modal/client-modal.component';
import { SessionModalComponent } from '../../../shared/modals/session-modal/session-modal.component';
import { CreateWizardModalComponent } from '../../../shared/modals/create-wizard-modal/create-wizard-modal.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-client-details',
  imports: [CommonModule, IonicModule],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class DetailsComponent implements OnInit, ViewWillEnter {
  // ─── Injected Dependencies ─────────────────────────────────────
  private readonly route = inject(ActivatedRoute);
  private readonly clientsService = inject(ClientsService);
  private readonly subscriptionsService = inject(SubscriptionsService);
  private readonly locationsService = inject(LocationsService);
  private readonly sessionsService = inject(SessionsService);
  private readonly notificationService = inject(NotificationService);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly actionSheetCtrl = inject(ActionSheetController);

  // ─── State Signals ─────────────────────────────────────────────
  clientId?: number;
  client = signal<any>(null);
  selectedTab = signal<'notes' | 'metrics' | 'sessions' | 'subscriptions'>('notes');
  isLoading = signal(true);

  upcomingSessions = signal<any[]>([]);
  pastSessions = signal<any[]>([]);
  subscriptions = signal<ClientSubscription[]>([]);

  readonly activeSubscriptions = computed(() =>
    this.subscriptions().filter((s) => s.status === 'ACTIVE'),
  );
  readonly activeSubscription = computed(() => this.activeSubscriptions()[0] || null);
  readonly hasMultipleActiveSubscriptions = computed(() => this.activeSubscriptions().length > 1);

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.clientId = +id;
        this.loadClient(+id);
      }
    });
  }

  ionViewWillEnter() {
    if (this.clientId) {
      this.loadClient(this.clientId);
    }
  }

  loadClient(id: number) {
    this.isLoading.set(true);
    this.clientsService.getOne(id).subscribe({
      next: (data) => {
        // Sort metrics from oldest to newest
        if (data.metrics && data.metrics.length > 0) {
          data.metrics = [...data.metrics].sort((a: any, b: any) => {
            const dateA = new Date(a.date || a.createdAt).getTime();
            const dateB = new Date(b.date || b.createdAt).getTime();
            return dateA - dateB;
          });
        }
        
        this.client.set(data);

        if (data.subscriptions && data.subscriptions.length > 0) {
          this.subscriptions.set(data.subscriptions);
        }
        
        const now = new Date();
        if (data.participations) {
          const upcoming = data.participations.filter((p: any) => new Date(p.session.startTime) >= now);
          const past = data.participations.filter((p: any) => new Date(p.session.startTime) < now);
          this.upcomingSessions.set(upcoming);
          this.pastSessions.set(past);
        }

        this.loadSubscriptions(id);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  setTab(tab: any) {
    this.selectedTab.set(tab);
  }

  async addNote() {
    const modal = await this.modalCtrl.create({
      component: NoteModalComponent
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.clientsService.addNote(this.client().id, data)
        .subscribe(() => this.loadClient(this.client().id));
    }
  }

  async editNote(note: any) {
    const modal = await this.modalCtrl.create({
      component: NoteModalComponent,
      componentProps: { note }
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.clientsService.updateNote(this.client().id, note.id, data)
        .subscribe(() => this.loadClient(this.client().id));
    }
  }

  addMetric() {
    this.router.navigate(['/tabs/clients', this.client().id, 'metrics', 'new']);
  }

  editMetric(metric: any) {
    this.router.navigate(['/tabs/clients', this.client().id, 'metrics', metric.id]);
  }

  async openMedia(url: string) {
    const modal = await this.modalCtrl.create({
      component: MediaViewerModalComponent,
      componentProps: { mediaUrl: url }
    });
    await modal.present();
  }

  isVideo(url: string): boolean {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov)$/i) != null;
  }

  async editSession(sessionId: number) {
    try {
      const [session, locs, cls] = await Promise.all([
        firstValueFrom(this.sessionsService.getById(sessionId)),
        firstValueFrom(this.locationsService.getAll()),
        firstValueFrom(this.clientsService.getAll()),
      ]);

      const modal = await this.modalCtrl.create({
        component: SessionModalComponent,
        componentProps: {
          session,
          locations: locs || [],
          clients: cls || [],
          persistOnSubmit: true,
        },
      });
      await modal.present();

      const { data, role } = await modal.onWillDismiss();
      if (role === 'confirm' || role === 'delete' || data?.mutated) {
        if (this.clientId) {
          this.loadClient(this.clientId);
        }
      }
    } catch {
      this.router.navigate(['/tabs/sessions', sessionId]);
    }
  }

  async scheduleWorkout(initialStep: 'TYPE_CHOICE' | 'SUBSCRIPTION' | 'SINGLE' = 'TYPE_CHOICE'): Promise<void> {
    const currentClient = this.client();
    if (!currentClient) return;

    const [locs, cls] = await Promise.all([
      firstValueFrom(this.locationsService.getAll()),
      firstValueFrom(this.clientsService.getAll()),
    ]);

    const clientsList = cls || [];
    const hasCurrentClient = clientsList.some((c) => c.id === currentClient.id);

    const modal = await this.modalCtrl.create({
      component: CreateWizardModalComponent,
      componentProps: {
        locations: locs || [],
        clients: hasCurrentClient ? clientsList : [currentClient, ...clientsList],
        preselectedClientId: currentClient.id,
        initialStep,
      },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data?.created) {
      this.loadClient(currentClient.id);
    }
  }

  async openProfileActions(): Promise<void> {
    const currentClient = this.client();
    if (!currentClient) return;

    const isArchived = currentClient.isActive === false;
    const actionSheet = await this.actionSheetCtrl.create({
      header: currentClient.fullName,
      buttons: [
        {
          text: 'Копіювати посилання на профіль',
          icon: 'share-social-outline',
          handler: () => {
            void this.shareProfile();
          },
        },
        {
          text: 'Редагувати профіль',
          icon: 'create-outline',
          handler: () => {
            void this.editClientProfile();
          },
        },
        {
          text: isArchived ? 'Відновити з архіву' : 'Перенести в архів',
          icon: isArchived ? 'arrow-undo-outline' : 'archive-outline',
          handler: () => {
            if (isArchived) {
              this.restoreClientProfile();
            } else {
              this.archiveClientProfile();
            }
          },
        },
        {
          text: 'Видалити профіль',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => {
            void this.confirmDeleteClientProfile();
          },
        },
        {
          text: 'Скасувати',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  async editClientProfile(): Promise<void> {
    const currentClient = this.client();
    if (!currentClient) return;

    const modal = await this.modalCtrl.create({
      component: ClientModalComponent,
      componentProps: { client: currentClient },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.clientsService.update(currentClient.id, data).subscribe({
        next: () => {
          this.loadClient(currentClient.id);
          void this.showToast('Профіль оновлено', 'success');
        },
        error: () => void this.showToast('Не вдалося оновити профіль', 'danger'),
      });
    }
  }

  archiveClientProfile(): void {
    const currentClient = this.client();
    if (!currentClient) return;

    this.clientsService.archive(currentClient.id).subscribe({
      next: async () => {
        await this.showToast(`«${currentClient.fullName}» перенесено в архів`, 'medium');
        this.loadClient(currentClient.id);
      },
      error: () => void this.showToast('Не вдалося архівувати клієнта', 'danger'),
    });
  }

  restoreClientProfile(): void {
    const currentClient = this.client();
    if (!currentClient) return;

    this.clientsService.restore(currentClient.id).subscribe({
      next: async () => {
        await this.showToast(`«${currentClient.fullName}» відновлено з архіву`, 'success');
        this.loadClient(currentClient.id);
      },
      error: () => void this.showToast('Не вдалося відновити клієнта', 'danger'),
    });
  }

  async confirmDeleteClientProfile(): Promise<void> {
    const currentClient = this.client();
    if (!currentClient) return;

    const alert = await this.alertCtrl.create({
      header: 'Видалити профіль?',
      message: `Клієнт «${currentClient.fullName}» зникне зі списку та архіву, а публічне посилання вимкнеться. Історія минулих тренувань та звіти збережуться.`,
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Видалити',
          role: 'destructive',
          handler: () => {
            this.clientsService.deleteClient(currentClient.id).subscribe({
              next: async () => {
                await this.showToast('Профіль клієнта видалено', 'medium');
                await this.router.navigate(['/tabs/clients']);
              },
              error: () => void this.showToast('Не вдалося видалити профіль', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
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

  async shareProfile() {
    const token = this.client()?.shareToken;
    if (!token) {
      const toast = await this.toastCtrl.create({
        message: 'Профіль ще не синхронізовано для поширення.',
        duration: 3000,
        color: 'warning'
      });
      toast.present();
      return;
    }
    
    const url = `${environment.clientUrl}/portal/${token}`;
    
    try {
      await navigator.clipboard.writeText(url);
      const toast = await this.toastCtrl.create({
        message: 'Посилання на публічний профіль скопійовано!',
        duration: 3000,
        color: 'success',
        icon: 'checkmark-circle-outline',
        position: 'top'
      });
      toast.present();
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  // ─── Subscriptions ──────────────────────────────────────────────

  async addSubscription(): Promise<void> {
    await this.scheduleWorkout('SUBSCRIPTION');
  }

  async editSubscription(sub: ClientSubscription): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SubscriptionModalComponent,
      componentProps: { clientId: this.client().id, subscription: sub },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || !data) return;

    this.subscriptionsService.update(sub.id, data).subscribe({
      next: (updated) => {
        if (updated.endDate && updated.status === 'ACTIVE') {
          this.notificationService.scheduleSubscriptionExpiry({
            id: updated.id,
            endDate: updated.endDate,
            clientName: this.client()?.fullName || 'Клієнт',
          });
        } else {
          this.notificationService.cancelSubscriptionExpiry(sub.id);
        }
        this.loadSubscriptions(this.client().id);
        this.showToast('Абонемент оновлено', 'success');
      },
      error: (err) => {
        const msg = err?.error?.message || 'Помилка при оновленні абонементу';
        this.showToast(msg, 'danger');
      },
    });
  }

  async deleteSubscription(sub: ClientSubscription): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Видалити абонемент?',
      message: 'Оберіть, що зробити із запланованими майбутніми тренуваннями цього абонементу:',
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Лише абонемент',
          handler: () => this.performDeleteSubscription(sub, false),
        },
        {
          text: 'З майбутніми заняттями',
          role: 'destructive',
          handler: () => this.performDeleteSubscription(sub, true),
        },
      ],
    });
    await alert.present();
  }

  private performDeleteSubscription(sub: ClientSubscription, deleteUpcomingSessions: boolean): void {
    this.subscriptionsService.delete(sub.id, deleteUpcomingSessions).subscribe({
      next: (res) => {
        this.notificationService.cancelSubscriptionExpiry(sub.id);
        const deletedIds = res?.deletedSessionIds || [];
        for (const sessionId of deletedIds) {
          this.notificationService.cancelForSession(sessionId);
        }
        this.loadClient(this.client().id);
        const msg =
          deleteUpcomingSessions && deletedIds.length > 0
            ? `Абонемент та ${deletedIds.length} майбутніх тренувань видалено`
            : 'Абонемент видалено';
        void this.showToast(msg, 'success');
      },
      error: () => void this.showToast('Не вдалося видалити абонемент', 'danger'),
    });
  }

  togglePayment(sub: ClientSubscription): void {
    this.subscriptionsService.togglePayment(sub.id, !sub.isPaid).subscribe({
      next: () => this.loadSubscriptions(this.client().id),
    });
  }

  async openSubscriptionDetail(sub: ClientSubscription): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SubscriptionDetailModalComponent,
      componentProps: {
        subscription: sub,
        client: this.client(),
      },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'delete' || data?.mutated) {
      this.loadClient(this.client().id);
      return;
    }
    this.loadSubscriptions(this.client().id);
  }

  async scheduleRecurringForSubscription(sub: ClientSubscription): Promise<void> {
    const locs = await firstValueFrom(this.locationsService.getAll());
    const modal = await this.modalCtrl.create({
      component: RecurringModalComponent,
      componentProps: {
        clients: [this.client()],
        locations: locs,
        preselectedClientId: this.client().id,
        preselectedSubscriptionId: sub.id,
      },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data?.created) {
      this.loadClient(this.client().id);
    }
  }

  getSubscriptionStatusColor(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'EXPIRED': return 'danger';
      case 'EXHAUSTED': return 'warning';
      default: return 'medium';
    }
  }

  getSubscriptionStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'Активний';
      case 'EXPIRED': return 'Прострочений';
      case 'EXHAUSTED': return 'Вичерпаний';
      default: return status;
    }
  }

  getSubscriptionTypeLabel(type: string): string {
    return type === 'SESSIONS_BASED' ? 'По кількості' : 'По датах';
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private loadSubscriptions(clientId: number): void {
    this.subscriptionsService.getAll({ clientId }).subscribe({
      next: (subs) => this.subscriptions.set(subs),
      error: (err) => {
        console.error('Failed to load subscriptions', err);
        const fallbackSubs = this.client()?.subscriptions || [];
        this.subscriptions.set(fallbackSubs);
      },
    });
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color });
    await toast.present();
  }
}

