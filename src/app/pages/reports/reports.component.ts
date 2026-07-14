import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { ReportsService, ReportSummary } from '../../core/services/reports.service';

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

  constructor(private reportsService: ReportsService) {}

  ngOnInit() {
    this.setDefaultDates();
    this.loadSummary();
  }

  setDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Format YYYY-MM-DD
    this.startDate = firstDay.toISOString().split('T')[0];
    this.endDate = today.toISOString().split('T')[0];
  }

  loadSummary() {
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
  }

  onDateChange() {
    this.loadSummary();
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
