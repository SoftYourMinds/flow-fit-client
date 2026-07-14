import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Client {
  id: number;
  fullName: string;
  phone?: string;
  goal?: string;
  currentWeight?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClientsService {
  private readonly apiUrl = environment.apiUrl + '/clients';

  constructor(private http: HttpClient) {}

  getAll(searchQuery?: string): Observable<Client[]> {
    let params = new HttpParams();
    if (searchQuery) {
      params = params.append('search', searchQuery);
    }
    return this.http.get<Client[]>(this.apiUrl, { params });
  }

  getOne(id: number) {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  create(data: Partial<Client>) {
    return this.http.post<Client>(this.apiUrl, data);
  }

  update(id: number, data: Partial<Client>) {
    return this.http.put<Client>(`${this.apiUrl}/${id}`, data);
  }

  archive(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  addNote(id: number, data: { text: string; links?: string[] }) {
    return this.http.post(`${this.apiUrl}/${id}/notes`, data);
  }

  updateNote(clientId: number, noteId: number, data: { text: string; links?: string[] }) {
    return this.http.put(`${this.apiUrl}/${clientId}/notes/${noteId}`, data);
  }

  addMetric(id: number, data: { weight?: number; bodyFatPercentage?: number; note?: string }) {
    return this.http.post(`${this.apiUrl}/${id}/metrics`, data);
  }
}
