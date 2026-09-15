import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

import { WorkoutSession } from './sessions.service';

export interface ClientSubscription {
  id: number;
  trainerId: number;
  clientId: number;
  client?: { id: number; fullName: string };
  type: 'SESSIONS_BASED' | 'DATE_RANGE';
  status: 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED';
  totalSessions: number | null;
  usedSessions: number;
  startDate: string | null;
  endDate: string | null;
  price: number;
  isPaid: boolean;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionPayload {
  clientId: number;
  type?: 'SESSIONS_BASED' | 'DATE_RANGE';
  totalSessions?: number;
  startDate?: string;
  endDate?: string;
  price?: number;
  isPaid?: boolean;
}

export interface CreateSubscriptionWithRecurringPayload {
  clientId: number;
  locationId: number;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  dateFrom: string;
  dateTo: string;
  price?: number;
  isPaid?: boolean;
  workoutTypes?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class SubscriptionsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/subscriptions`;

  // ─── Public Methods ─────────────────────────────────────────────

  getAll(filters?: { clientId?: number; status?: string }): Observable<ClientSubscription[]> {
    let params = new HttpParams();
    if (filters?.clientId) {
      params = params.append('clientId', filters.clientId);
    }
    if (filters?.status) {
      params = params.append('status', filters.status);
    }
    return this.http.get<ClientSubscription[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ClientSubscription> {
    return this.http.get<ClientSubscription>(`${this.apiUrl}/${id}`);
  }

  getActiveForClient(clientId: number): Observable<ClientSubscription[]> {
    return this.http.get<ClientSubscription[]>(`${this.apiUrl}/client/${clientId}/active`);
  }

  create(data: CreateSubscriptionPayload): Observable<ClientSubscription> {
    return this.http.post<ClientSubscription>(this.apiUrl, data);
  }

  update(id: number, data: Partial<CreateSubscriptionPayload>): Observable<ClientSubscription> {
    return this.http.put<ClientSubscription>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  deductSession(subscriptionId: number, sessionId: number): Observable<ClientSubscription> {
    return this.http.post<ClientSubscription>(
      `${this.apiUrl}/${subscriptionId}/deduct/${sessionId}`,
      {},
    );
  }

  togglePayment(id: number, isPaid: boolean): Observable<ClientSubscription> {
    return this.http.put<ClientSubscription>(`${this.apiUrl}/${id}`, { isPaid });
  }

  createWithRecurring(
    data: CreateSubscriptionWithRecurringPayload,
  ): Observable<{ subscription: ClientSubscription; sessionsCount: number }> {
    return this.http.post<{ subscription: ClientSubscription; sessionsCount: number }>(
      `${this.apiUrl}/with-recurring`,
      data,
    );
  }

  getSubscriptionSessions(subscriptionId: number): Observable<WorkoutSession[]> {
    return this.http.get<WorkoutSession[]>(`${this.apiUrl}/${subscriptionId}/sessions`);
  }
}
