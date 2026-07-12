import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface SessionParticipant {
  id: number;
  sessionId: number;
  clientId?: number;
  client?: any;
  customName?: string;
}

export interface WorkoutSession {
  id: number;
  locationId: number;
  location?: any;
  type: 'INDIVIDUAL' | 'GROUP';
  startTime: string;
  endTime: string;
  pricePerPerson: number;
  totalPrice?: number;
  status: 'UPCOMING' | 'ACTIVE' | 'REQUIRED_ACTION' | 'COMPLETED' | 'MISSED';
  participants: SessionParticipant[];
}

@Injectable({
  providedIn: 'root'
})
export class SessionsService {
  private apiUrl = `${environment.apiUrl}/sessions`;

  constructor(private http: HttpClient) {}

  getAll(filters?: any): Observable<WorkoutSession[]> {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null) {
          params = params.append(key, filters[key]);
        }
      });
    }
    return this.http.get<WorkoutSession[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<WorkoutSession> {
    return this.http.get<WorkoutSession>(`${this.apiUrl}/${id}`);
  }

  create(data: any): Observable<WorkoutSession> {
    return this.http.post<WorkoutSession>(this.apiUrl, data);
  }

  update(id: number, data: any): Observable<WorkoutSession> {
    return this.http.put<WorkoutSession>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  addParticipant(sessionId: number, data: any): Observable<SessionParticipant> {
    return this.http.post<SessionParticipant>(`${this.apiUrl}/${sessionId}/participants`, data);
  }

  removeParticipant(sessionId: number, participantId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${sessionId}/participants/${participantId}`);
  }

  duplicateWeek(sourceStart: string, targetStart: string): Observable<WorkoutSession[]> {
    return this.http.post<WorkoutSession[]>(`${this.apiUrl}/duplicate-week`, { sourceStart, targetStart });
  }
}
