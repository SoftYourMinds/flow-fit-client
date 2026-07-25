import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ViewWillEnter } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { ReportsService, ReportSummary } from '../../core/services/reports.service';
import { SessionsService, WorkoutSession } from '../../core/services/sessions.service';
import { LocationsService, Location } from '../../core/services/locations.service';

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, BaseChartDirective]
})
export class ReportsComponent implements OnInit, ViewWillEnter {
  startDate: string = '';
  endDate: string = '';
  summary: ReportSummary | null = null;
  isLoading: boolean = false;
  isGeneratingReport: boolean = false;
  isFallbackModalOpen: boolean = false;
  fallbackReportText: string = '';

  locations: Location[] = [];
  selectedLocationId: number | null = null;
  
  selectedWorkoutTypes: string[] = [];
  readonly WORKOUT_TYPE_OPTIONS = [
    'stretching',
    'fly stretching',
    'yoga',
    'functional',
    'pilates',
    'power pilates'
  ];

  // Segment for displaying metrics
  reportType: 'all' | 'individual' | 'group' = 'all';
  


  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
      },
    },
  };
  public pieChartData: ChartData<'pie', number[], string | string[]> = {
    labels: ['Індивідуальні', 'Групові'],
    datasets: [
      {
        data: [0, 0],
        backgroundColor: ['#C88A72', '#E8C5B8'],
        hoverBackgroundColor: ['#b3755c', '#d3a696'],
      },
    ],
  };
  public pieChartType: ChartType = 'pie';

  constructor(
    private reportsService: ReportsService,
    private sessionsService: SessionsService,
    private locationsService: LocationsService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadLocations();
    this.setDefaultDates();
  }

  ionViewWillEnter() {
    this.loadData();
  }

  setDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Format YYYY-MM-DD (local)
    this.startDate = getLocalDateString(firstDay);
    this.endDate = getLocalDateString(today);
  }

  loadData() {
    if (!this.startDate || !this.endDate) return;

    this.isLoading = true;
    this.reportsService.getSummary(this.startDate, this.endDate, this.selectedLocationId, this.selectedWorkoutTypes).subscribe({
      next: (data) => {
        this.summary = data;
        this.updateChartData();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load reports summary', err);
        this.isLoading = false;
      }
    });

  }

  closeFallbackModal() {
    this.isFallbackModalOpen = false;
  }

  loadLocations() {
    this.locationsService.getAll().subscribe({
      next: (locs) => {
        this.locations = locs;
      },
      error: (err) => console.error('Failed to load locations', err)
    });
  }

  onDateChange() {
    this.loadData();
  }

  onLocationChange() {
    this.loadData();
  }

  onWorkoutTypeChange() {
    this.loadData();
  }

  get displayedIncome(): number {
    if (!this.summary) return 0;
    if (this.reportType === 'individual') return this.summary.incomeBreakdown.individual;
    if (this.reportType === 'group') return this.summary.incomeBreakdown.group;
    return this.summary.totalIncome;
  }

  get displayedStats(): { totalClients: number, totalSessions: number, missedRate: number } {
    if (!this.summary) return { totalClients: 0, totalSessions: 0, missedRate: 0 };
    if (this.reportType === 'individual') return this.summary.statistics.individual;
    if (this.reportType === 'group') return this.summary.statistics.group;
    return this.summary.statistics.all;
  }



  private updateChartData() {
    if (this.summary) {
      this.pieChartData.datasets[0].data = [
        this.summary.incomeBreakdown.individual,
        this.summary.incomeBreakdown.group
      ];
      // Trigger change detection for chart
      this.pieChartData = { ...this.pieChartData };
    }
  }

  async generateTextReport() {
    if (!this.startDate || !this.endDate) return;

    this.isGeneratingReport = true;
    try {
      const filters: any = { 
        startDate: this.startDate, 
        endDate: this.endDate 
      };
      
      if (this.selectedLocationId) {
        filters.locationId = this.selectedLocationId;
      }
      
      if (this.selectedWorkoutTypes && this.selectedWorkoutTypes.length > 0) {
        filters.workoutTypes = this.selectedWorkoutTypes.join(','); 
      }

      // Fetch sessions for the period
      const sessions = await firstValueFrom(this.sessionsService.getAll(filters));

      // Filter locally to match the UI filters just in case
      let filteredSessions = sessions.filter(s => {
        if (s.status !== 'COMPLETED') return false; 
        
        if (this.selectedLocationId && s.locationId !== this.selectedLocationId) return false;
        
        if (this.selectedWorkoutTypes && this.selectedWorkoutTypes.length > 0) {
           const hasMatchedType = s.workoutTypes?.some(type => this.selectedWorkoutTypes.includes(type));
           if (!hasMatchedType && s.workoutTypes && s.workoutTypes.length > 0) return false;
        }

        if (this.reportType === 'individual' && s.type !== 'INDIVIDUAL') return false;
        if (this.reportType === 'group' && s.type !== 'GROUP') return false;

        return true;
      });

      // Sort by date ascending
      filteredSessions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      let reportText = `Звіт за період: ${this.startDate} по ${this.endDate}\n\n`;
      let totalSum = 0;

      if (filteredSessions.length === 0) {
        reportText += `Тренувань не знайдено.\n`;
      } else {
        filteredSessions.forEach((s, index) => {
          const date = new Date(s.startTime);
          const dateStr = date.toLocaleDateString('uk-UA', { 
            day: '2-digit', month: '2-digit', year: 'numeric'
          });
          const timeStr = date.toLocaleTimeString('uk-UA', {
            hour: '2-digit', minute: '2-digit'
          });
          const typeStr = s.type === 'INDIVIDUAL' ? 'Інд.' : 'Груп.';
          const price = s.price || 0;
          totalSum += price;
          
          let workoutTypesStr = '';
          if (s.workoutTypes && s.workoutTypes.length > 0) {
            workoutTypesStr = ` (${s.workoutTypes.join(', ')})`;
          }

          reportText += `${index + 1}. ${dateStr} ${timeStr} - ${typeStr}${workoutTypesStr} - ${price} ₴\n`;
        });
        reportText += `\n------------------------\n`;
        reportText += `Загальна сума: ${totalSum} ₴\n`;
      }

      let copySuccess = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(reportText);
          copySuccess = true;
        }
      } catch (e) {
        console.warn('Clipboard API failed:', e);
      }

      if (!copySuccess) {
        const textArea = document.createElement('textarea');
        textArea.value = reportText;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        
        const isIos = navigator.userAgent.match(/ipad|iphone|ipod/i);
        if (isIos) {
          textArea.contentEditable = 'true';
          textArea.readOnly = false;
          const range = document.createRange();
          range.selectNodeContents(textArea);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          textArea.setSelectionRange(0, 999999);
        } else {
          textArea.focus();
          textArea.select();
        }
        
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            copySuccess = true;
          }
        } catch (err) {
          console.warn('execCommand copy failed', err);
        } finally {
          document.body.removeChild(textArea);
        }
      }
      
      if (copySuccess) {
        const toast = await this.toastCtrl.create({
          message: 'Звіт скопійовано',
          duration: 2000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      } else {
        this.fallbackReportText = reportText;
        this.isFallbackModalOpen = true;
      }
      
    } catch (err) {
      console.error('Failed to generate report', err);
      const toast = await this.toastCtrl.create({
        message: 'Помилка при генерації звіту',
        duration: 2000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    } finally {
      this.isGeneratingReport = false;
    }
  }
}
