import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, ViewWillEnter } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SessionsService, WorkoutSession } from '../../core/services/sessions.service';
import { LocationsService, Location } from '../../core/services/locations.service';
import { ClientsService, Client } from '../../core/services/clients.service';
import { NotificationService } from '../../core/services/notification.service';
import { SessionModalComponent } from '../../shared/modals/session-modal/session-modal.component';
import { WeekViewComponent } from './week-view/week-view.component';
import { MonthViewComponent } from './month-view/month-view.component';

export interface DayTab {
  date: Date;
  dateStr: string; // YYYY-MM-DD (local)
  dayName: string; // Пн, Вт, etc.
  dayNum: number;  // 13
  monthShort: string; // Сер, Вер, etc.
  isToday: boolean;
  count: number;
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-scheduler',
  imports: [CommonModule, IonicModule, FormsModule, WeekViewComponent, MonthViewComponent],
  templateUrl: './scheduler.component.html',
  styleUrls: ['./scheduler.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SchedulerComponent implements OnInit, ViewWillEnter {
  // ─── Injected Dependencies ───────────────────────────────────────
  private readonly sessionsService = inject(SessionsService);
  private readonly locationsService = inject(LocationsService);
  private readonly clientsService = inject(ClientsService);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  // ─── Constants ──────────────────────────────────────────────────
  readonly WORKOUT_TYPE_OPTIONS = [
    'stretching',
    'fly stretching',
    'yoga',
    'functional',
    'pilates',
    'power pilates'
  ] as const;

  private readonly MONTH_SHORT = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];

  // ─── Signals / State ────────────────────────────────────────────
  readonly sessions = signal<WorkoutSession[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly isLoading = signal(true);

  // View modes
  readonly viewMode = signal<'day' | 'week' | 'month'>('day');

  // Date selection (defaults to today)
  readonly selectedDate = signal<Date>(new Date());

  // Filters
  readonly filterStatus = signal<string>('ALL');
  readonly filterType = signal<string>('ALL');
  readonly filterLocationId = signal<number | null>(null);
  readonly filterWorkoutTypes = signal<string[]>([]);

  // ─── Derived State (Computed) ───────────────────────────────────

  // Week days computed (Monday - Sunday of the week containing selectedDate)
  readonly weekDays = computed<DayTab[]>(() => {
    const ref = new Date(this.selectedDate());
    const dow = ref.getDay(); // 0=Sun
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const days: DayTab[] = [];
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    const todayStr = getLocalDateString(new Date());
    const allSessions = this.sessions();

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = getLocalDateString(d);

      const count = allSessions.filter(s => {
        const sDateStr = getLocalDateString(new Date(s.startTime));
        return sDateStr === dateStr;
      }).length;

      days.push({
        date: d,
        dateStr,
        dayName: dayNames[i],
        dayNum: d.getDate(),
        monthShort: this.MONTH_SHORT[d.getMonth()],
        isToday: dateStr === todayStr,
        count
      });
    }
    return days;
  });

  // Range label for the current week (e.g. "Вересень 2026" or "Серпень – Вересень 2026")
  readonly weekMonthLabel = computed<string>(() => {
    const days = this.weekDays();
    if (days.length === 0) return '';
    const firstDate = days[0].date;
    const lastDate = days[6].date;
    const firstMonth = firstDate.toLocaleDateString('uk-UA', { month: 'long' });
    const lastMonth = lastDate.toLocaleDateString('uk-UA', { month: 'long' });
    const year = lastDate.getFullYear();

    const capFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

    if (firstMonth === lastMonth) {
      return `${capFirst(firstMonth)} ${year}`;
    }
    return `${capFirst(firstMonth)} – ${capFirst(lastMonth)} ${year}`;
  });

  // Selected date string (YYYY-MM-DD)
  readonly selectedDateStr = computed(() => {
    return getLocalDateString(this.selectedDate());
  });

  // Computed filtered sessions
  readonly filteredSessions = computed(() => {
    let list = this.sessions();
    const mode = this.viewMode();
    const targetDateStr = this.selectedDateStr();
    const status = this.filterStatus();
    const type = this.filterType();
    const locId = this.filterLocationId();

    if (mode === 'day') {
      list = list.filter(s => {
        const sDateStr = getLocalDateString(new Date(s.startTime));
        return sDateStr === targetDateStr;
      });
    } else if (mode === 'week') {
      const curr = new Date(this.selectedDate());
      const dow = curr.getDay();
      const diffToMonday = dow === 0 ? -6 : 1 - dow;
      const startOfWeek = new Date(curr);
      startOfWeek.setDate(curr.getDate() + diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      list = list.filter(s => {
        const sDate = new Date(s.startTime);
        return sDate >= startOfWeek && sDate <= endOfWeek;
      });
    } else if (mode === 'month') {
      const curr = new Date(this.selectedDate());
      const startOfMonth = new Date(curr.getFullYear(), curr.getMonth(), 1);
      const endOfMonth = new Date(curr.getFullYear(), curr.getMonth() + 1, 0, 23, 59, 59, 999);

      list = list.filter(s => {
        const sDate = new Date(s.startTime);
        return sDate >= startOfMonth && sDate <= endOfMonth;
      });
    }

    if (status !== 'ALL') {
      list = list.filter(s => s.status === status);
    }

    if (type !== 'ALL') {
      list = list.filter(s => s.type === type);
    }

    if (locId !== null) {
      list = list.filter(s => s.locationId === locId);
    }

    const wTypes = this.filterWorkoutTypes();
    if (wTypes && wTypes.length > 0) {
      list = list.filter(s => {
        if (!s.workoutTypes || s.workoutTypes.length === 0) return false;
        return wTypes.some(t => s.workoutTypes!.includes(t));
      });
    }

    return list;
  });

  // ─── Lifecycle Hooks ────────────────────────────────────────────
  ngOnInit(): void {
    this.loadData();
  }

  ionViewWillEnter(): void {
    this.loadData();
  }

  // ─── Public Methods ─────────────────────────────────────────────
  loadData(event?: unknown): void {
    const isRefresh = Boolean(event);
    if (!isRefresh) {
      this.isLoading.set(true);
    }

    this.sessionsService.getAll().subscribe({
      next: (data) => {
        this.sessions.set(data);
        this.notificationService.syncNotifications(data);
        if (!isRefresh) this.isLoading.set(false);
        if (event) (event as { target: { complete: () => void } }).target.complete();
      },
      error: () => {
        if (!isRefresh) this.isLoading.set(false);
        if (event) (event as { target: { complete: () => void } }).target.complete();
      }
    });

    this.locationsService.getAll().subscribe({
      next: (locs) => this.locations.set(locs)
    });

    this.clientsService.getAll().subscribe({
      next: (cls) => this.clients.set(cls)
    });
  }

  handleRefresh(event: unknown): void {
    this.loadData(event);
  }

  goToSessionDetail(sessionId: number): void {
    this.router.navigate(['/tabs/sessions', sessionId]);
  }

  selectDay(day: DayTab): void {
    this.selectedDate.set(new Date(day.date));
  }

  previousWeek(): void {
    const prev = new Date(this.selectedDate());
    prev.setDate(prev.getDate() - 7);
    this.selectedDate.set(prev);
  }

  nextWeek(): void {
    const next = new Date(this.selectedDate());
    next.setDate(next.getDate() + 7);
    this.selectedDate.set(next);
  }

  goToToday(): void {
    this.selectedDate.set(new Date());
  }

  // ── Week / Month child view handlers ──────────────────────────────────────
  onWeekSessionClicked(sessionId: number): void {
    this.router.navigate(['/tabs/sessions', sessionId]);
  }

  onWeekDateChanged(date: Date): void {
    this.selectedDate.set(date);
  }

  onMonthSessionClicked(sessionId: number): void {
    this.router.navigate(['/tabs/sessions', sessionId]);
  }

  onMonthDateSelected(date: Date): void {
    this.selectedDate.set(date);
  }

  onMonthChanged(date: Date): void {
    this.selectedDate.set(date);
  }

  async openCreateSessionModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SessionModalComponent,
      componentProps: {
        locations: this.locations(),
        clients: this.clients()
      }
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || !data) {
      return;
    }

    const participants = data.participants || [];
    const enableNotification = data.enableNotification;
    const reminderMode = data.reminderMode;

    delete data.participants;
    delete data.enableNotification;
    delete data.reminderMode;

    this.sessionsService.create(data).subscribe((session) => {
      if (enableNotification) {
        const loc = this.locations().find(l => l.id === session.locationId);
        if (loc) {
          this.notificationService.scheduleForSession(session, loc.name, reminderMode);
        }
      }

      if (participants.length > 0) {
        const requests = participants.map((p: any) => this.sessionsService.addParticipant(session.id, p));
        forkJoin(requests).subscribe(() => this.loadData());
      } else {
        this.loadData();
      }
    });
  }

  updateStatus(id: number, status: any): void {
    this.sessionsService.update(id, { status }).subscribe(() => this.loadData());
  }

  deleteSession(id: number): void {
    this.sessionsService.delete(id).subscribe(() => {
      this.notificationService.cancelForSession(id);
      this.loadData();
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
}
