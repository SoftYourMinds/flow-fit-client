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
    all: { totalClients: number; totalSessions: number; missedRate: number };
    individual: { totalClients: number; totalSessions: number; missedRate: number };
    group: { totalClients: number; totalSessions: number; missedRate: number };
  };
}

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  private apiUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  getSummary(startDate: string, endDate: string, locationId?: number | null): Observable<ReportSummary> {
    let params: any = { startDate, endDate };
    if (locationId) {
      params.locationId = locationId.toString();
    }
    
    return this.http.get<ReportSummary>(`${this.apiUrl}/summary`, {
      params,
    });
  }
}
