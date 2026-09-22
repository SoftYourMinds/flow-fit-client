import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface SessionParticipant {
  id: number;
  sessionId: number;
  clientId?: number;
  client?: { id: number; fullName: string; phone?: string };
  customName?: string;
}

export interface WorkoutSession {
  id: number;
  locationId: number;
  location?: { id: number; name: string };
  type: 'INDIVIDUAL' | 'GROUP';
  startTime: string;
  endTime: string;
  price: number;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'MISSED' | 'REQUIRED_ACTION';
  isPaid: boolean;
  subscriptionId?: number | null;
  workoutTypes?: string[];
  maxParticipants?: number;
  anonymousParticipantsCount?: number;
  participants: SessionParticipant[];
}

export interface RecurringSessionsPayload {
  clientId: number;
  locationId: number;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  dateFrom: string;
  dateTo: string;
  timezoneOffset?: number;
  subscriptionId?: number;
  price?: number;
  workoutTypes?: string[];
}

export interface RecurringPreviewItem {
  startTime: string;
  endTime: string;
  date: string;
  dayOfWeek: number;
  hasConflict: boolean;
  conflictReason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SessionsService {
  private readonly apiUrl = `${environment.apiUrl}/sessions`;

  constructor(private readonly http: HttpClient) {}

  getAll(filters?: Record<string, unknown>): Observable<WorkoutSession[]> {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        const val = filters[key];
        if (val !== undefined && val !== null) {
          params = params.append(key, String(val));
        }
      });
    }
    return this.http.get<WorkoutSession[]>(this.apiUrl, { params, headers: { 'x-silent-request': 'true' } });
  }

  getById(id: number): Observable<WorkoutSession> {
    return this.http.get<WorkoutSession>(`${this.apiUrl}/${id}`, { headers: { 'x-silent-request': 'true' } });
  }

  create(data: unknown): Observable<WorkoutSession> {
    return this.http.post<WorkoutSession>(this.apiUrl, data);
  }

  update(id: number, data: unknown): Observable<WorkoutSession> {
    return this.http.put<WorkoutSession>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  addParticipant(sessionId: number, data: unknown): Observable<SessionParticipant> {
    return this.http.post<SessionParticipant>(`${this.apiUrl}/${sessionId}/participants`, data);
  }

  removeParticipant(sessionId: number, participantId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${sessionId}/participants/${participantId}`);
  }

  duplicateWeek(sourceStart: string, targetStart: string): Observable<WorkoutSession[]> {
    return this.http.post<WorkoutSession[]>(`${this.apiUrl}/duplicate-week`, { sourceStart, targetStart });
  }

  previewRecurring(data: RecurringSessionsPayload): Observable<RecurringPreviewItem[]> {
    return this.http.post<RecurringPreviewItem[]>(`${this.apiUrl}/recurring/preview`, data);
  }

  createRecurring(data: RecurringSessionsPayload): Observable<WorkoutSession[]> {
    return this.http.post<WorkoutSession[]>(`${this.apiUrl}/recurring`, data);
  }
}
