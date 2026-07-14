import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReportSummary {
  totalIncome: number;
  incomeBreakdown: {
    individual: number;
    group: number;
  };
  statistics: {
    totalClients: number;
    totalSessions: number;
    missedRate: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  private apiUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  getSummary(startDate: string, endDate: string): Observable<ReportSummary> {
    return this.http.get<ReportSummary>(`${this.apiUrl}/summary`, {
      params: { startDate, endDate },
    });
  }
}
