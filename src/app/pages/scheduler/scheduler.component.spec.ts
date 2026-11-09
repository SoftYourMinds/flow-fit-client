import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { IonicModule } from '@ionic/angular';
import { of } from 'rxjs';

import { SchedulerComponent } from './scheduler.component';
import { SessionsService } from '../../core/services/sessions.service';
import { LocationsService } from '../../core/services/locations.service';
import { ClientsService } from '../../core/services/clients.service';

describe('SchedulerComponent', () => {
  let component: SchedulerComponent;
  let fixture: ComponentFixture<SchedulerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), SchedulerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SessionsService,
          useValue: {
            getAll: () => of([]),
            create: () => of({}),
            update: () => of({}),
            delete: () => of({})
          }
        },
        {
          provide: LocationsService,
          useValue: {
            getAll: () => of([])
          }
        },
        {
          provide: ClientsService,
          useValue: {
            getAll: () => of([])
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SchedulerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should correctly calculate weekDays across month boundary (August - September)', () => {
    // Set selected date to Thursday, September 3, 2026
    component.selectedDate.set(new Date(2026, 8, 3)); // Month index 8 is September
    fixture.detectChanges();

    const days = component.weekDays();
    expect(days.length).toBe(7);

    // Monday should be Aug 31
    expect(days[0].dayName).toBe('Пн');
    expect(days[0].dayNum).toBe(31);
    expect(days[0].dateStr).toBe('2026-08-31');

    // Tuesday should be Sep 1
    expect(days[1].dayName).toBe('Вт');
    expect(days[1].dayNum).toBe(1);
    expect(days[1].dateStr).toBe('2026-09-01');

    // Friday should be Sep 4 (NOT August 4!)
    expect(days[4].dayName).toBe('Пт');
    expect(days[4].dayNum).toBe(4);
    expect(days[4].dateStr).toBe('2026-09-04');

    // Sunday should be Sep 6
    expect(days[6].dayName).toBe('Нд');
    expect(days[6].dayNum).toBe(6);
    expect(days[6].dateStr).toBe('2026-09-06');
  });

  it('should set selectedDate to September 4 when clicking Friday of September week', () => {
    component.selectedDate.set(new Date(2026, 8, 3));
    fixture.detectChanges();

    const fridayTab = component.weekDays()[4];
    component.selectDay(fridayTab);

    expect(component.selectedDateStr()).toBe('2026-09-04');
    expect(component.selectedDate().getMonth()).toBe(8); // September
    expect(component.selectedDate().getDate()).toBe(4);
  });

  it('should display correct weekMonthLabel for a week crossing month boundaries', () => {
    component.selectedDate.set(new Date(2026, 8, 3));
    fixture.detectChanges();

    expect(component.weekMonthLabel()).toBe('Серпень – Вересень 2026');
  });

  it('should highlight today correctly when selectedDate is today', () => {
    const today = new Date();
    component.selectedDate.set(today);
    fixture.detectChanges();

    const todayTab = component.weekDays().find(d => d.isToday);
    expect(todayTab).toBeDefined();
    expect(todayTab?.date.getDate()).toBe(today.getDate());
    expect(component.selectedDateStr()).toBe(todayTab!.dateStr);
  });

  it('should reset selectedDate to today when goToToday is called', () => {
    // Navigate away to a past date
    component.selectedDate.set(new Date(2025, 0, 1));
    fixture.detectChanges();
    expect(component.selectedDateStr()).toBe('2025-01-01');

    component.goToToday();
    fixture.detectChanges();

    const now = new Date();
    expect(component.selectedDate().toDateString()).toBe(now.toDateString());
  });

  it('should filter sessions by location using criteriaFilteredSessions', () => {
    component.sessions.set([
      {
        id: 1,
        locationId: 10,
        type: 'INDIVIDUAL',
        startTime: '2026-09-02T10:00:00.000Z',
        endTime: '2026-09-02T11:00:00.000Z',
        price: 300,
        status: 'UPCOMING',
        isPaid: false,
        participants: []
      },
      {
        id: 2,
        locationId: 20,
        type: 'GROUP',
        startTime: '2026-09-02T12:00:00.000Z',
        endTime: '2026-09-02T13:00:00.000Z',
        price: 400,
        status: 'COMPLETED',
        isPaid: true,
        participants: []
      }
    ] as any);

    expect(component.criteriaFilteredSessions().length).toBe(2);

    // Filter by location 10
    component.onLocationChange(10);
    expect(component.criteriaFilteredSessions().length).toBe(1);
    expect(component.criteriaFilteredSessions()[0].id).toBe(1);

    // Filter by location via string representation (from ion-select event)
    component.onLocationChange('20');
    expect(component.criteriaFilteredSessions().length).toBe(1);
    expect(component.criteriaFilteredSessions()[0].id).toBe(2);

    // Reset to ALL
    component.onLocationChange('ALL');
    expect(component.criteriaFilteredSessions().length).toBe(2);
  });

  it('should filter sessions by status, type, and case-insensitive workout types', () => {
    component.sessions.set([
      {
        id: 1,
        locationId: 1,
        type: 'INDIVIDUAL',
        status: 'UPCOMING',
        workoutTypes: ['Functional', 'Pilates'],
        startTime: '2026-09-02T10:00:00.000Z',
        endTime: '2026-09-02T11:00:00.000Z',
        price: 300,
        isPaid: false,
        participants: []
      },
      {
        id: 2,
        locationId: 1,
        type: 'GROUP',
        status: 'COMPLETED',
        workoutTypes: ['yoga'],
        startTime: '2026-09-02T12:00:00.000Z',
        endTime: '2026-09-02T13:00:00.000Z',
        price: 400,
        isPaid: true,
        participants: []
      }
    ] as any);

    // Status filter
    component.filterStatus.set('COMPLETED');
    expect(component.criteriaFilteredSessions().length).toBe(1);
    expect(component.criteriaFilteredSessions()[0].id).toBe(2);

    // Type filter
    component.filterStatus.set('ALL');
    component.filterType.set('INDIVIDUAL');
    expect(component.criteriaFilteredSessions().length).toBe(1);
    expect(component.criteriaFilteredSessions()[0].id).toBe(1);

    // Workout type case-insensitive
    component.filterType.set('ALL');
    component.onWorkoutTypesChange(['functional']);
    expect(component.criteriaFilteredSessions().length).toBe(1);
    expect(component.criteriaFilteredSessions()[0].id).toBe(1);

    // Reset filters
    component.resetFilters();
    expect(component.criteriaFilteredSessions().length).toBe(2);
    expect(component.hasActiveFilters()).toBeFalse();
  });
});
