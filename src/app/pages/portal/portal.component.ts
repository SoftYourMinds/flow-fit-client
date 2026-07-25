import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';

@Component({
  selector: 'app-portal',
  standalone: true,
  imports: [CommonModule, IonicModule, BaseChartDirective],
  templateUrl: './portal.component.html',
  styleUrls: ['./portal.component.scss']
})
export class PortalComponent implements OnInit {
  profile = signal<any>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  activeTab = signal<'history' | 'metrics'>('history');
  activeChartMetric = signal<'weight' | 'bodyFatPercentage' | 'chest' | 'waist'>('weight');
  isDarkMode = signal(false);

  // Computed properties
  initials = computed(() => {
    const prof = this.profile();
    if (!prof || !prof.fullName) return 'C';
    const names = prof.fullName.split(' ');
    if (names.length > 1) {
      return names[0].charAt(0).toUpperCase() + names[1].charAt(0).toUpperCase();
    }
    return prof.fullName.substring(0, 2).toUpperCase();
  });

  latestMetrics = computed(() => {
    const prof = this.profile();
    if (prof && prof.metrics && prof.metrics.length > 0) {
      return prof.metrics[prof.metrics.length - 1];
    }
    return null;
  });

  nextSession = computed(() => {
    const prof = this.profile();
    if (prof && prof.sessions) {
      const now = new Date().getTime();
      const upcoming = prof.sessions
        .filter((s: any) => new Date(s.startTime).getTime() >= now && s.status !== 'MISSED' && s.status !== 'COMPLETED')
        .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      return upcoming.length > 0 ? upcoming[0] : null;
    }
    return null;
  });

  recentSessions = computed(() => {
    const prof = this.profile();
    if (prof && prof.sessions) {
      const now = new Date().getTime();
      return prof.sessions
        .filter((s: any) => new Date(s.startTime).getTime() < now)
        .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 5); // Show last 5 sessions
    }
    return [];
  });

  highlightedDates = computed(() => {
    const prof = this.profile();
    if (prof && prof.sessions) {
      return prof.sessions.map((session: any) => {
        // format date as YYYY-MM-DD
        const date = new Date(session.startTime);
        const dateString = date.toISOString().split('T')[0];
        
        let color = '#C88A72'; // default primary
        if (session.isAttended === true) color = '#7EA172'; // success
        else if (session.isAttended === false) color = '#C96B6B'; // danger

        return {
          date: dateString,
          textColor: '#ffffff',
          backgroundColor: color,
        };
      });
    }
    return [];
  });

  // Chart configuration
  public lineChartData = computed<ChartConfiguration['data']>(() => {
    const prof = this.profile();
    if (!prof || !prof.metrics || prof.metrics.length === 0) {
      return { datasets: [], labels: [] };
    }

    const metricKey = this.activeChartMetric();
    const data = prof.metrics.map((m: any) => m[metricKey] || null); // Use null for missing data points
    
    let label = 'Вага (кг)';
    if (metricKey === 'bodyFatPercentage') label = 'Відсоток жиру (%)';
    if (metricKey === 'chest') label = 'Груди (см)';
    if (metricKey === 'waist') label = 'Талія (см)';

    const labels = prof.metrics.map((m: any) => {
      const d = new Date(m.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    return {
      datasets: [
        {
          data: data,
          label: label,
          backgroundColor: 'rgba(200, 138, 114, 0.2)', // primary with opacity
          borderColor: '#C88A72', // primary
          pointBackgroundColor: '#C88A72',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#C88A72',
          fill: 'origin',
          tension: 0.4,
          spanGaps: true // Connect lines even if some data points are null
        }
      ],
      labels: labels
    };
  });

  public lineChartOptions: ChartConfiguration['options'] = {
    elements: {
      line: { tension: 0.5 }
    },
    scales: {
      x: {
        grid: { display: false }
      },
      y: {
        position: 'left',
        grid: { color: 'rgba(0,0,0,0.05)' },
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(20, 18, 17, 0.8)',
        titleFont: { size: 13 },
        bodyFont: { size: 14, weight: 'bold' },
        padding: 10,
        cornerRadius: 8,
        displayColors: false
      }
    },
    responsive: true,
    maintainAspectRatio: false
  };

  public lineChartType: ChartType = 'line';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit() {
    // Initialize theme based on current state or system preference
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isCurrentlyDark = document.documentElement.classList.contains('ion-palette-dark') || document.body.classList.contains('dark') || prefersDark;
    this.isDarkMode.set(isCurrentlyDark);
    this.applyTheme(isCurrentlyDark);

    this.route.paramMap.subscribe(params => {
      const token = params.get('token');
      if (token) {
        this.loadProfile(token);
      } else {
        this.error.set('Невірне посилання.');
        this.isLoading.set(false);
      }
    });
  }

  loadProfile(token: string) {
    this.isLoading.set(true);
    this.error.set(null);
    this.http.get(`${environment.apiUrl}/portal/client/${token}`, {
      headers: {
        'x-silent-request': 'true',
        'x-silent-error': 'true'
      }
    }).subscribe({
      next: (data) => {
        this.profile.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Профіль не знайдено або він недоступний.');
        this.isLoading.set(false);
      }
    });
  }

  toggleTheme() {
    const newTheme = !this.isDarkMode();
    this.isDarkMode.set(newTheme);
    this.applyTheme(newTheme);
  }

  private applyTheme(isDark: boolean) {
    if (isDark) {
      document.documentElement.classList.add('ion-palette-dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('ion-palette-dark');
      document.body.classList.remove('dark');
    }
  }
}
