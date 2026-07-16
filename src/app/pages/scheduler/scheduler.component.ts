import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, ActionSheetController, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { SessionsService, WorkoutSession } from '../../core/services/sessions.service';
import { LocationsService, Location } from '../../core/services/locations.service';
import { ClientsService, Client } from '../../core/services/clients.service';
import { Router } from '@angular/router';
import { SessionModalComponent } from '../../shared/modals/session-modal/session-modal.component';
import { ParticipantModalComponent } from '../../shared/modals/participant-modal/participant-modal.component';
import { forkJoin } from 'rxjs';
import { NotificationService } from '../../core/services/notification.service';

export interface DayTab {
  date: Date;
  dateStr: string; // YYYY-MM-DD (local)
  dayName: string; // Пн, Вт, etc.
  dayNum: number;  // 13
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
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  templateUrl: './scheduler.component.html',
  styleUrls: ['./scheduler.component.scss']
})
export class SchedulerComponent implements OnInit {
  sessions = signal<WorkoutSession[]>([]);
  locations = signal<Location[]>([]);
  clients = signal<Client[]>([]);
  isLoading = signal(true);

  // View modes
  viewMode = signal<'day' | 'week' | 'month'>('day');

  // Date selection (defaults to today)
  selectedDate = signal<Date>(new Date());

  // Filters
  filterStatus = signal<string>('ALL');
  filterType = signal<string>('ALL');
  filterLocationId = signal<number | null>(null);

  // Week days computed (Monday - Sunday of the week containing selectedDate)
  weekDays = computed<DayTab[]>(() => {
    const curr = new Date(this.selectedDate());
    const first = curr.getDate() - (curr.getDay() === 0 ? 6 : curr.getDay() - 1); // Monday
    
    const days: DayTab[] = [];
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    const todayStr = getLocalDateString(new Date());
    const allSessions = this.sessions();

    for (let i = 0; i < 7; i++) {
      const d = new Date(curr.setDate(first + i));
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
        isToday: dateStr === todayStr,
        count
      });
    }
    return days;
  });

  // Selected date string (YYYY-MM-DD)
  selectedDateStr = computed(() => {
    return getLocalDateString(this.selectedDate());
  });

  // Computed filtered sessions
  filteredSessions = computed(() => {
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
      const first = curr.getDate() - (curr.getDay() === 0 ? 6 : curr.getDay() - 1);
      const startOfWeek = new Date(curr);
      startOfWeek.setDate(first);
      startOfWeek.setHours(0,0,0,0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23,59,59,999);
      
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

    // Status filter
    if (status !== 'ALL') {
      list = list.filter(s => s.status === status);
    }

    // Type filter
    if (type !== 'ALL') {
      list = list.filter(s => s.type === type);
    }

    // Location filter
    if (locId !== null) {
      list = list.filter(s => s.locationId === locId);
    }

    return list;
  });

  // Grouped sessions for list view (grouped by date)
  groupedSessions = computed(() => {
    const list = this.filteredSessions();
    const map = new Map<string, WorkoutSession[]>();
    
    for (const session of list) {
      const dateStr = new Date(session.startTime).toLocaleDateString('uk-UA', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(session);
    }
    
    return Array.from(map.entries()).map(([dateLabel, items]) => ({
      dateLabel,
      items
    }));
  });

  constructor(
    private sessionsService: SessionsService,
    private locationsService: LocationsService,
    private clientsService: ClientsService,
    private modalCtrl: ModalController,
    private actionSheetCtrl: ActionSheetController,
    private toastCtrl: ToastController,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData(event?: any) {
    if (!event) this.isLoading.set(true);
    
    // Fetch sessions
    this.sessionsService.getAll().subscribe({
      next: (data) => {
        this.sessions.set(data);
        this.notificationService.syncNotifications(data);
        if (!event) this.isLoading.set(false);
        if (event) event.target.complete();
      },
      error: () => {
        if (!event) this.isLoading.set(false);
        if (event) event.target.complete();
      }
    });

    // Fetch locations for labels and form dropdowns
    this.locationsService.getAll().subscribe({
      next: (locs) => this.locations.set(locs)
    });

    // Fetch clients for participant selection
    this.clientsService.getAll().subscribe({
      next: (cls) => this.clients.set(cls)
    });
  }

  handleRefresh(event: any) {
    this.loadData(event);
  }

  goToSessionDetail(sessionId: number) {
    this.router.navigate(['/tabs/sessions', sessionId]);
  }

  selectDay(day: DayTab) {
    this.selectedDate.set(new Date(day.date));
  }

  previousWeek() {
    const prev = new Date(this.selectedDate());
    prev.setDate(prev.getDate() - 7);
    this.selectedDate.set(prev);
  }

  nextWeek() {
    const next = new Date(this.selectedDate());
    next.setDate(next.getDate() + 7);
    this.selectedDate.set(next);
  }

  goToToday() {
    this.selectedDate.set(new Date());
  }

  async openCreateSessionModal() {
    const modal = await this.modalCtrl.create({
      component: SessionModalComponent,
      componentProps: {
        locations: this.locations(),
        clients: this.clients()
      }
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      const participants = data.participants || [];
      const enableNotification = data.enableNotification;
      const reminderMode = data.reminderMode;
      
      delete data.participants;
      delete data.enableNotification;
      delete data.reminderMode;

      this.sessionsService.create(data).subscribe((session) => {
        // Schedule notification
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
  }





  updateStatus(id: number, status: any) {
    this.sessionsService.update(id, { status }).subscribe(() => this.loadData());
  }

  deleteSession(id: number) {
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
