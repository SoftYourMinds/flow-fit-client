import {
  Component,
  OnInit,
  Input,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ActionSheetController,
  AlertController,
  IonicModule,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { Client, ClientsService } from '../../../core/services/clients.service';
import { LocationsService } from '../../../core/services/locations.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WorkoutSession } from '../../../core/services/sessions.service';
import {
  SubscriptionsService,
  ClientSubscription,
} from '../../../core/services/subscriptions.service';
import { SessionModalComponent } from '../session-modal/session-modal.component';
import { RecurringModalComponent } from '../recurring-modal/recurring-modal.component';
import { SubscriptionModalComponent } from '../subscription-modal/subscription-modal.component';

export interface CalendarDayCell {
  date: Date;
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasSession: boolean;
  session?: WorkoutSession;
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-subscription-detail-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './subscription-detail-modal.component.html',
  styleUrls: ['./subscription-detail-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionDetailModalComponent implements OnInit {
  // ─── Dependencies ──────────────────────────────────────────────
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly subscriptionsService = inject(SubscriptionsService);
  private readonly locationsService = inject(LocationsService);
  private readonly clientsService = inject(ClientsService);
  private readonly notificationService = inject(NotificationService);

  private hasMutated = false;

  // ─── Inputs ────────────────────────────────────────────────────
  @Input({ required: true }) subscription!: ClientSubscription;
  @Input() client?: Client;

  // ─── Constants ─────────────────────────────────────────────────
  readonly WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  readonly UKRAINIAN_DAYS_FULL = [
    'Неділя',
    'Понеділок',
    'Вівторок',
    'Середа',
    'Четвер',
    'П’ятниця',
    'Субота',
  ];
  readonly UKRAINIAN_DAYS_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  readonly UKRAINIAN_MONTHS = [
    'Січень',
    'Лютий',
    'Березень',
    'Квітень',
    'Травень',
    'Червень',
    'Липень',
    'Серпень',
    'Вересень',
    'Жовтень',
    'Листопад',
    'Грудень',
  ];

  // ─── State Signals ─────────────────────────────────────────────
  readonly activeTab = signal<'CALENDAR' | 'LIST'>('CALENDAR');
  readonly sessions = signal<WorkoutSession[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly currentMonthDate = signal<Date>(new Date());
  readonly selectedDateStr = signal<string>(getLocalDateString(new Date()));
  readonly isPaid = signal<boolean>(false);

  // ─── Computed ──────────────────────────────────────────────────
  readonly sortedSessions = computed(() => {
    return [...this.sessions()].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  });

  readonly monthLabel = computed(() => {
    const d = this.currentMonthDate();
    return `${this.UKRAINIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  readonly calendarWeeks = computed<CalendarDayCell[][]>(() => {
    const ref = this.currentMonthDate();
    const year = ref.getFullYear();
    const month = ref.getMonth();

    const todayStr = getLocalDateString(new Date());
    const subSessions = this.sessions();

    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const lastDay = new Date(year, month + 1, 0);

    const cells: CalendarDayCell[] = [];

    // Prev month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      const dStr = getLocalDateString(d);
      const session = subSessions.find(
        (s) => getLocalDateString(new Date(s.startTime)) === dStr,
      );
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        hasSession: !!session,
        session,
      });
    }

    // Days in current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const d = new Date(year, month, day);
      const dStr = getLocalDateString(d);
      const session = subSessions.find(
        (s) => getLocalDateString(new Date(s.startTime)) === dStr,
      );
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        hasSession: !!session,
        session,
      });
    }

    // Next month padding
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 1; i <= 7 - remainder; i++) {
        const d = new Date(year, month + 1, i);
        const dStr = getLocalDateString(d);
        const session = subSessions.find(
          (s) => getLocalDateString(new Date(s.startTime)) === dStr,
        );
        cells.push({
          date: d,
          dateStr: dStr,
          dayNum: i,
          isCurrentMonth: false,
          isToday: dStr === todayStr,
          hasSession: !!session,
          session,
        });
      }
    }

    // Group into 7-day rows
    const weeks: CalendarDayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  });

  readonly selectedDateSessions = computed<WorkoutSession[]>(() => {
    const targetStr = this.selectedDateStr();
    return this.sessions().filter(
      (s) => getLocalDateString(new Date(s.startTime)) === targetStr,
    );
  });

  // ─── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    if (this.subscription) {
      this.isPaid.set(this.subscription.isPaid);
      if (this.subscription.startDate) {
        const d = new Date(this.subscription.startDate);
        this.currentMonthDate.set(new Date(d.getFullYear(), d.getMonth(), 1));
        this.selectedDateStr.set(getLocalDateString(d));
      }
      this.loadSessions();
    }
  }

  // ─── Public Methods ─────────────────────────────────────────────
  cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(
      this.hasMutated ? { mutated: true } : null,
      'cancel',
    );
  }

  async openSubscriptionActions(): Promise<void> {
    const buttons: any[] = [
      {
        text: 'Редагувати абонемент',
        icon: 'create-outline',
        handler: () => {
          void this.editSubscription();
        },
      },
    ];

    if (this.subscription.status === 'ACTIVE') {
      buttons.unshift({
        text: 'Додати серію тренувань',
        icon: 'repeat-outline',
        handler: () => {
          void this.scheduleRecurring();
        },
      });
    }

    buttons.push(
      {
        text: 'Видалити абонемент',
        role: 'destructive',
        icon: 'trash-outline',
        handler: () => {
          void this.confirmDeleteSubscription();
        },
      },
      {
        text: 'Скасувати',
        role: 'cancel',
      },
    );

    const sheet = await this.actionSheetCtrl.create({
      header: 'Керування абонементом',
      buttons,
    });
    await sheet.present();
  }

  async editSession(session: WorkoutSession): Promise<void> {
    const [locs, cls] = await Promise.all([
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
      this.hasMutated = true;
      this.refreshSubscriptionAndSessions();
    }
  }

  async addSessionForSelectedDate(): Promise<void> {
    const [locs, cls] = await Promise.all([
      firstValueFrom(this.locationsService.getAll()),
      firstValueFrom(this.clientsService.getAll()),
    ]);

    const clientsList = cls || [];
    const targetClient = this.client;
    const mergedClients =
      targetClient && !clientsList.some((c) => c.id === targetClient.id)
        ? [targetClient, ...clientsList]
        : clientsList;

    const modal = await this.modalCtrl.create({
      component: SessionModalComponent,
      componentProps: {
        locations: locs || [],
        clients: mergedClients,
        preselectedDate: this.selectedDateStr(),
        preselectedClientId: this.subscription.clientId,
        preselectedSubscriptionId: this.subscription.id,
        persistOnSubmit: true,
      },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' || data?.mutated) {
      this.hasMutated = true;
      this.refreshSubscriptionAndSessions();
    }
  }

  async scheduleRecurring(): Promise<void> {
    const locs = await firstValueFrom(this.locationsService.getAll());
    const clientObj = this.client || {
      id: this.subscription.clientId,
      fullName: this.subscription.client?.fullName || 'Клієнт',
    };

    const modal = await this.modalCtrl.create({
      component: RecurringModalComponent,
      componentProps: {
        clients: [clientObj],
        locations: locs || [],
        preselectedClientId: this.subscription.clientId,
        preselectedSubscriptionId: this.subscription.id,
      },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data?.created) {
      this.hasMutated = true;
      this.refreshSubscriptionAndSessions();
    }
  }

  async editSubscription(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SubscriptionModalComponent,
      componentProps: {
        clientId: this.subscription.clientId,
        subscription: this.subscription,
      },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || !data) return;

    this.subscriptionsService.update(this.subscription.id, data).subscribe({
      next: (updated) => {
        this.subscription = { ...this.subscription, ...updated };
        this.isPaid.set(updated.isPaid);
        this.hasMutated = true;
        void this.showToast('Абонемент оновлено', 'success');
      },
      error: (err) => {
        void this.showToast(err?.error?.message || 'Помилка оновлення абонементу', 'danger');
      },
    });
  }

  async confirmDeleteSubscription(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Видалити абонемент?',
      message: 'Оберіть, що зробити із запланованими майбутніми тренуваннями цього абонементу:',
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Лише абонемент',
          handler: () => {
            void this.deleteSubscription(false);
          },
        },
        {
          text: 'З майбутніми заняттями',
          role: 'destructive',
          handler: () => {
            void this.deleteSubscription(true);
          },
        },
      ],
    });
    await alert.present();
  }

  private async deleteSubscription(deleteUpcomingSessions: boolean): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.subscriptionsService.delete(this.subscription.id, deleteUpcomingSessions),
      );
      this.notificationService.cancelSubscriptionExpiry(this.subscription.id);
      const deletedIds = res?.deletedSessionIds || [];
      for (const sessionId of deletedIds) {
        await this.notificationService.cancelForSession(sessionId);
      }
      await this.showToast(
        deleteUpcomingSessions && deletedIds.length > 0
          ? `Абонемент та ${deletedIds.length} майбутніх тренувань видалено`
          : 'Абонемент видалено',
        'success',
      );
      await this.modalCtrl.dismiss({ deleted: true, mutated: true }, 'delete');
    } catch {
      await this.showToast('Не вдалося видалити абонемент', 'danger');
    }
  }

  private refreshSubscriptionAndSessions(): void {
    this.subscriptionsService.getById(this.subscription.id).subscribe({
      next: (fresh) => {
        this.subscription = { ...this.subscription, ...fresh };
        this.isPaid.set(fresh.isPaid);
      },
      error: () => {},
    });
    this.loadSessions();
  }

  previousMonth(): void {
    const current = this.currentMonthDate();
    this.currentMonthDate.set(
      new Date(current.getFullYear(), current.getMonth() - 1, 1),
    );
  }

  nextMonth(): void {
    const current = this.currentMonthDate();
    this.currentMonthDate.set(
      new Date(current.getFullYear(), current.getMonth() + 1, 1),
    );
  }

  selectDay(cell: CalendarDayCell): void {
    this.selectedDateStr.set(cell.dateStr);
  }

  togglePaymentStatus(): void {
    const nextVal = !this.isPaid();
    this.subscriptionsService.togglePayment(this.subscription.id, nextVal).subscribe({
      next: (updated) => {
        this.isPaid.set(updated.isPaid);
        this.showToast(
          updated.isPaid ? 'Абонемент відмічено як оплачений' : 'Оплату скасовано',
          'success',
        );
      },
      error: () => this.showToast('Не вдалося змінити статус оплати', 'danger'),
    });
  }

  formatUkrainianDateWithDay(dateStr: string): string {
    const d = new Date(dateStr);
    const dayShort = this.UKRAINIAN_DAYS_SHORT[d.getDay()];
    const day = d.getDate();
    const month = d.toLocaleDateString('uk-UA', { month: 'long' });
    return `${dayShort}, ${day} ${month}`;
  }

  formatTimeRange(startTime: string, endTime: string): string {
    const start = new Date(startTime).toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const end = new Date(endTime).toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${start} - ${end}`;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'UPCOMING':
        return 'primary';
      case 'ACTIVE':
        return 'warning';
      case 'COMPLETED':
        return 'success';
      case 'MISSED':
        return 'danger';
      default:
        return 'medium';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'UPCOMING':
        return 'Заплановано';
      case 'ACTIVE':
        return 'Триває';
      case 'COMPLETED':
        return 'Завершено';
      case 'MISSED':
        return 'Пропущено';
      default:
        return status;
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────
  private loadSessions(): void {
    this.isLoading.set(true);
    this.subscriptionsService
      .getSubscriptionSessions(this.subscription.id)
      .subscribe({
        next: (items) => {
          this.sessions.set(items);
          this.isLoading.set(false);

          if (items.length > 0 && !this.subscription.startDate) {
            const first = new Date(items[0].startTime);
            this.currentMonthDate.set(
              new Date(first.getFullYear(), first.getMonth(), 1),
            );
            this.selectedDateStr.set(getLocalDateString(first));
          }
        },
        error: () => {
          this.sessions.set([]);
          this.isLoading.set(false);
        },
      });
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
