import { Component, ChangeDetectionStrategy, input, output, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { WorkoutSession } from '../../../core/services/sessions.service';

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface DayColumn {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNum: number;
  month: string;
  isToday: boolean;
}

@Component({
  selector: 'app-week-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule],
  templateUrl: './week-view.component.html',
  styleUrls: ['./week-view.component.scss'],
})
export class WeekViewComponent {
  readonly sessions = input.required<WorkoutSession[]>();
  readonly selectedDate = input.required<Date>();

  readonly sessionClicked = output<number>();
  readonly dateChanged = output<Date>();

  readonly DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  readonly MONTH_SHORT = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];

  @ViewChild('headerScroll') headerScrollRef!: ElementRef<HTMLDivElement>;
  @ViewChild('gridScroll') gridScrollRef!: ElementRef<HTMLDivElement>;

  // ── Week columns ─────────────────────────────────────────────────────────
  readonly weekColumns = computed<DayColumn[]>(() => {
    const ref = new Date(this.selectedDate());
    const dow = ref.getDay(); // 0=Sun
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const todayStr = getLocalDateString(new Date());
    return this.DAY_NAMES.map((dayName, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        date: d,
        dateStr: getLocalDateString(d),
        dayName,
        dayNum: d.getDate(),
        month: this.MONTH_SHORT[d.getMonth()],
        isToday: getLocalDateString(d) === todayStr,
      };
    });
  });

  // ── Time slots ───────────────────────────────────────────────────────────
  readonly timeSlots = computed<number[]>(() => {
    const allSessions = this.weekSessions();
    if (allSessions.length === 0) {
      // Default range when no sessions
      return Array.from({ length: 15 }, (_, i) => i + 7); // 07–21
    }
    const hours = allSessions.map(s => new Date(s.startTime).getHours());
    const minH = Math.max(0, Math.min(...hours) - 1);
    const maxH = Math.min(23, Math.max(...hours) + 2);
    return Array.from({ length: maxH - minH + 1 }, (_, i) => i + minH);
  });

  // ── Sessions filtered to current week ────────────────────────────────────
  readonly weekSessions = computed<WorkoutSession[]>(() => {
    const cols = this.weekColumns();
    if (cols.length === 0) return [];
    const startStr = cols[0].dateStr;
    const endStr = cols[6].dateStr;
    return this.sessions().filter(s => {
      const sStr = getLocalDateString(new Date(s.startTime));
      return sStr >= startStr && sStr <= endStr;
    });
  });

  // ── Sessions mapped by dayIndex + hour ───────────────────────────────────
  readonly sessionGrid = computed<Map<string, WorkoutSession[]>>(() => {
    const grid = new Map<string, WorkoutSession[]>();
    for (const session of this.weekSessions()) {
      const sDate = new Date(session.startTime);
      const sDateStr = getLocalDateString(sDate);
      const hour = sDate.getHours();
      const key = `${sDateStr}__${hour}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(session);
    }
    return grid;
  });

  // ─── Public Methods ─────────────────────────────────────────────

  getSessionsAt(dateStr: string, hour: number): WorkoutSession[] {
    return this.sessionGrid().get(`${dateStr}__${hour}`) ?? [];
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  getSessionName(session: WorkoutSession): string {
    if (session.workoutTypes && session.workoutTypes.length > 0) {
      return session.workoutTypes
        .map(t => t.charAt(0).toUpperCase() + t.slice(1))
        .join(' + ');
    }
    return session.type === 'GROUP' ? 'Групове' : 'Індивідуальне';
  }

  getCapacity(session: WorkoutSession): string {
    const current = session.participants.length;
    const max = session.maxParticipants;
    return max != null ? `${current}/${max}` : `${current}`;
  }

  isFull(session: WorkoutSession): boolean {
    if (session.maxParticipants == null) return false;
    return session.participants.length >= session.maxParticipants;
  }

  onSessionClick(sessionId: number): void {
    this.sessionClicked.emit(sessionId);
  }

  previousWeek(): void {
    const prev = new Date(this.selectedDate());
    prev.setDate(prev.getDate() - 7);
    this.dateChanged.emit(prev);
  }

  nextWeek(): void {
    const next = new Date(this.selectedDate());
    next.setDate(next.getDate() + 7);
    this.dateChanged.emit(next);
  }

  hasAnySessions(): boolean {
    return this.weekSessions().length > 0;
  }

  syncHeaderScroll(): void {
    if (!this.headerScrollRef?.nativeElement || !this.gridScrollRef?.nativeElement) return;
    const scrollLeft = this.gridScrollRef.nativeElement.scrollLeft;
    this.headerScrollRef.nativeElement.scrollLeft = scrollLeft;
  }
}
