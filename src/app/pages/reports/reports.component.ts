import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { ReportsService, ReportSummary } from '../../core/services/reports.service';
import { SessionsService, WorkoutSession } from '../../core/services/sessions.service';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, BaseChartDirective]
})
export class ReportsComponent implements OnInit {
  startDate: string = '';
  endDate: string = '';
  summary: ReportSummary | null = null;
  isLoading: boolean = false;

  // Segment for displaying metrics
  reportType: 'all' | 'individual' | 'group' = 'all';
  
  // Unpaid sessions
  unpaidSessions: WorkoutSession[] = [];

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
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.setDefaultDates();
    this.loadData();
  }

  setDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Format YYYY-MM-DD
    this.startDate = firstDay.toISOString().split('T')[0];
    this.endDate = today.toISOString().split('T')[0];
  }

  loadData() {
    if (!this.startDate || !this.endDate) return;

    this.isLoading = true;
    this.reportsService.getSummary(this.startDate, this.endDate).subscribe({
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

    this.loadUnpaidSessions();
  }

  loadUnpaidSessions() {
    // Ideally we filter by status and date range on backend, but here we just get all and filter
    this.sessionsService.getAll().subscribe(sessions => {
      // Find sessions that are not completed, missed, or upcoming
      this.unpaidSessions = sessions.filter(s => 
        (s.status === 'ACTIVE' || s.status === 'REQUIRED_ACTION') && 
        new Date(s.startTime) <= new Date()
      ).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    });
  }

  onDateChange() {
    this.loadData();
  }

  get displayedIncome(): number {
    if (!this.summary) return 0;
    if (this.reportType === 'individual') return this.summary.incomeBreakdown.individual;
    if (this.reportType === 'group') return this.summary.incomeBreakdown.group;
    return this.summary.totalIncome;
  }

  async markAsPaid(session: WorkoutSession) {
    this.sessionsService.update(session.id, { status: 'COMPLETED' }).subscribe(async () => {
      this.loadData(); // Reload both summary and unpaid sessions
      const toast = await this.toastCtrl.create({
        message: `✅ Оплату за тренування успішно зафіксовано!`,
        duration: 2000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
    });
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
}
