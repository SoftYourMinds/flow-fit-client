import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Location {
  id: number;
  name: string;
  type: 'STUDIO' | 'GYM' | 'OUTDOOR';
  address?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationsService {
  private readonly apiUrl = environment.apiUrl + '/locations';

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<Location[]>(this.apiUrl);
  }

  create(data: Partial<Location>) {
    return this.http.post<Location>(this.apiUrl, data);
  }

  update(id: number, data: Partial<Location>) {
    return this.http.put<Location>(`${this.apiUrl}/${id}`, data);
  }

  remove(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
