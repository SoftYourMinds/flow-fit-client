import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Location {
  id: number;
  name: string;
  type: 'STUDIO' | 'GYM' | 'OUTDOOR';
  address?: string;
  maxParticipants?: number;
  defaultGroupPrice?: number | null;
  defaultIndividualPrice?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class LocationsService {
  private readonly LAST_LOCATION_STORAGE_KEY = 'flowfit-last-location-id';
  private readonly apiUrl = environment.apiUrl + '/locations';
  private readonly http = inject(HttpClient);

  // ─── Public Methods ─────────────────────────────────────────────

  getAll(): Observable<Location[]> {
    return this.http.get<Location[]>(this.apiUrl, { headers: { 'x-silent-request': 'true' } });
  }

  create(data: Partial<Location>): Observable<Location> {
    return this.http.post<Location>(this.apiUrl, data);
  }

  update(id: number, data: Partial<Location>): Observable<Location> {
    return this.http.put<Location>(`${this.apiUrl}/${id}`, data);
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  saveLastSelectedLocationId(locationId: number): void {
    if (typeof localStorage === 'undefined' || !locationId) return;
    localStorage.setItem(this.LAST_LOCATION_STORAGE_KEY, String(locationId));
  }

  getLastSelectedLocationId(): number | null {
    if (typeof localStorage === 'undefined') return null;

    const raw = localStorage.getItem(this.LAST_LOCATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = Number(raw);
    const isValidId = Number.isInteger(parsed) && parsed > 0;
    return isValidId ? parsed : null;
  }

  resolveDefaultLocationId(locations: Location[]): number | null {
    if (!locations || locations.length === 0) return null;

    const lastId = this.getLastSelectedLocationId();
    const hasLastLocation = lastId !== null && locations.some((loc) => loc.id === lastId);
    return hasLastLocation ? lastId : locations[0].id;
  }

  resolveDefaultPrice(
    location: Location | null | undefined,
    sessionType: 'INDIVIDUAL' | 'GROUP',
  ): number | null {
    if (!location) return null;

    const candidate =
      sessionType === 'GROUP' ? location.defaultGroupPrice : location.defaultIndividualPrice;

    return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0
      ? candidate
      : null;
  }
}
