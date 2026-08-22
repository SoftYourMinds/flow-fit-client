import { Component, ChangeDetectionStrategy, input, output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { WorkoutSession } from '../../../core/services/sessions.service';

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface CalendarDay {
  date: Date;
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessionCount: number;
}

@Component({
  selector: 'app-month-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule],
  templateUrl: './month-view.component.html',
  styleUrls: ['./month-view.component.scss'],
})
export class MonthViewComponent {
  readonly sessions = input.required<WorkoutSession[]>();
  readonly selectedDate = input.required<Date>();

  readonly sessionClicked = output<number>();
  readonly dateSelected = output<Date>();
  readonly monthChanged = output<Date>();

  readonly MONTH_NAMES = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
  ];
  readonly WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  // Active selected date cell (for showing list below calendar)
  readonly activeDateStr = signal<string>(getLocalDateString(new Date()));

  // ── Calendar grid ─────────────────────────────────────────────────────────
  readonly calendarWeeks = computed<CalendarDay[][]>(() => {
    const ref = new Date(this.selectedDate());
    const year = ref.getFullYear();
    const month = ref.getMonth();

    const todayStr = getLocalDateString(new Date());
    const allSessions = this.sessions();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Weekday index of 1st (0=Mon … 6=Sun)
    const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    const cells: CalendarDay[] = [];

    // Padding from previous month
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      const dStr = getLocalDateString(d);
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        sessionCount: 0,
      });
    }

    // Days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const d = new Date(year, month, day);
      const dStr = getLocalDateString(d);
      const count = allSessions.filter(s => getLocalDateString(new Date(s.startTime)) === dStr).length;
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        sessionCount: count,
      });
    }

    // Padding to fill remaining cells (multiple of 7)
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 1; i <= 7 - remainder; i++) {
        const d = new Date(year, month + 1, i);
        const dStr = getLocalDateString(d);
        cells.push({
          date: d,
          dateStr: dStr,
          dayNum: i,
          isCurrentMonth: false,
          isToday: dStr === todayStr,
          sessionCount: 0,
        });
      }
    }

    // Split into weeks
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  });

  readonly monthLabel = computed(() => {
    const ref = new Date(this.selectedDate());
    return this.MONTH_NAMES[ref.getMonth()];
  });

  readonly yearLabel = computed(() => new Date(this.selectedDate()).getFullYear());

  // ── Sessions for the active (tapped) date ─────────────────────────────────
  readonly activeDateSessions = computed<WorkoutSession[]>(() => {
    const dateStr = this.activeDateStr();
    return this.sessions()
      .filter(s => getLocalDateString(new Date(s.startTime)) === dateStr)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  });

  readonly activeDateLabel = computed(() => {
    const d = new Date(this.activeDateStr() + 'T00:00:00');
    return d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  selectDay(day: CalendarDay): void {
    this.activeDateStr.set(day.dateStr);
    this.dateSelected.emit(day.date);
  }

  previousMonth(): void {
    const ref = new Date(this.selectedDate());
    ref.setDate(1);
    ref.setMonth(ref.getMonth() - 1);
    this.monthChanged.emit(ref);
  }

  nextMonth(): void {
    const ref = new Date(this.selectedDate());
    ref.setDate(1);
    ref.setMonth(ref.getMonth() + 1);
    this.monthChanged.emit(ref);
  }

  onSessionClick(sessionId: number): void {
    this.sessionClicked.emit(sessionId);
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
        .join(', ');
    }
    return session.type === 'GROUP' ? 'Групове' : 'Індивідуальне';
  }

  getCapacity(session: WorkoutSession): string {
    const current = session.participants.length;
    const max = session.maxParticipants;
    return max != null ? `${current}/${max}` : `${current}`;
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

  /** Returns a number[] of length min(count, 3) for @for dot rendering */
  dotsArray(count: number): number[] {
    return Array.from({ length: Math.min(count, 3) }, (_, i) => i);
  }
}
