import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, ActionSheetController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { SessionsService, WorkoutSession } from '../../core/services/sessions.service';
import { LocationsService, Location } from '../../core/services/locations.service';
import { ClientsService, Client } from '../../core/services/clients.service';
import { SessionModalComponent } from '../../shared/modals/session-modal/session-modal.component';
import { ParticipantModalComponent } from '../../shared/modals/participant-modal/participant-modal.component';

export interface DayTab {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayName: string; // Пн, Вт, etc.
  dayNum: number;  // 13
  isToday: boolean;
  count: number;
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
  viewMode = signal<'week' | 'list'>('week');

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
    const todayStr = new Date().toISOString().split('T')[0];
    const allSessions = this.sessions();

    for (let i = 0; i < 7; i++) {
      const d = new Date(curr.setDate(first + i));
      const dateStr = d.toISOString().split('T')[0];
      
      const count = allSessions.filter(s => {
        const sDateStr = new Date(s.startTime).toISOString().split('T')[0];
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
    return this.selectedDate().toISOString().split('T')[0];
  });

  // Computed filtered sessions
  filteredSessions = computed(() => {
    let list = this.sessions();
    const mode = this.viewMode();
    const targetDateStr = this.selectedDateStr();
    const status = this.filterStatus();
    const type = this.filterType();
    const locId = this.filterLocationId();

    // In week view, limit to selected day
    if (mode === 'week') {
      list = list.filter(s => {
        const sDateStr = new Date(s.startTime).toISOString().split('T')[0];
        return sDateStr === targetDateStr;
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
    private actionSheetCtrl: ActionSheetController
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    
    // Fetch sessions
    this.sessionsService.getAll().subscribe({
      next: (data) => {
        this.sessions.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
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
        locations: this.locations()
      }
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.sessionsService.create(data).subscribe(() => this.loadData());
    }
  }

  async openAddParticipantModal(session: WorkoutSession) {
    const modal = await this.modalCtrl.create({
      component: ParticipantModalComponent,
      componentProps: {
        clients: this.clients()
      }
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.sessionsService.addParticipant(session.id, data).subscribe(() => this.loadData());
    }
  }

  async removeParticipant(sessionId: number, participantId: number) {
    this.sessionsService.removeParticipant(sessionId, participantId).subscribe(() => this.loadData());
  }

  async openSessionActions(session: WorkoutSession) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: `Управління заняттям #${session.id}`,
      buttons: [
        {
          text: 'Позначити як ACTIVE',
          icon: 'play-outline',
          handler: () => this.updateStatus(session.id, 'ACTIVE')
        },
        {
          text: 'Позначити як COMPLETED',
          icon: 'checkmark-circle-outline',
          handler: () => this.updateStatus(session.id, 'COMPLETED')
        },
        {
          text: 'Позначити як MISSED',
          icon: 'close-circle-outline',
          handler: () => this.updateStatus(session.id, 'MISSED')
        },
        {
          text: 'Видалити заняття',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => this.deleteSession(session.id)
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
    this.sessionsService.update(id, { status }).subscribe(() => this.loadData());
  }

  deleteSession(id: number) {
    this.sessionsService.delete(id).subscribe(() => this.loadData());
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
