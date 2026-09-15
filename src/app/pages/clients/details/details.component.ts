import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, ToastController, AlertController, ViewWillEnter } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ClientsService } from '../../../core/services/clients.service';
import { SubscriptionsService, ClientSubscription } from '../../../core/services/subscriptions.service';
import { LocationsService } from '../../../core/services/locations.service';
import { NotificationService } from '../../../core/services/notification.service';
import { NoteModalComponent } from '../../../shared/modals/note-modal/note-modal.component';
import { MediaViewerModalComponent } from '../../../shared/modals/media-viewer-modal/media-viewer-modal.component';
import { SubscriptionModalComponent } from '../../../shared/modals/subscription-modal/subscription-modal.component';
import { RecurringModalComponent } from '../../../shared/modals/recurring-modal/recurring-modal.component';
import { SubscriptionDetailModalComponent } from '../../../shared/modals/subscription-detail-modal/subscription-detail-modal.component';
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
  private readonly notificationService = inject(NotificationService);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

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

  editSession(sessionId: number) {
    this.router.navigate(['/tabs/sessions', sessionId]);
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
    const modal = await this.modalCtrl.create({
      component: SubscriptionModalComponent,
      componentProps: { clientId: this.client().id },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || !data) return;

    this.subscriptionsService.create(data).subscribe({
      next: (created) => {
        if (created.endDate && created.status === 'ACTIVE') {
          this.notificationService.scheduleSubscriptionExpiry({
            id: created.id,
            endDate: created.endDate,
            clientName: this.client()?.fullName || 'Клієнт',
          });
        }
        this.loadSubscriptions(this.client().id);
        this.showToast('Абонемент успішно збережено', 'success');
      },
      error: (err) => {
        const msg = err?.error?.message || 'Помилка при створенні абонементу';
        this.showToast(msg, 'danger');
      },
    });
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
      message: 'Цю дію неможливо скасувати.',
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Видалити',
          role: 'destructive',
          handler: () => {
            this.subscriptionsService.delete(sub.id).subscribe({
              next: () => {
                this.notificationService.cancelSubscriptionExpiry(sub.id);
                this.loadSubscriptions(this.client().id);
              },
            });
          },
        },
      ],
    });
    await alert.present();
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

    await modal.onWillDismiss();
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

