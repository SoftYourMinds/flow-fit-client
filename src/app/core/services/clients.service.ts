import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  getAll() {
    return this.http.get<Client[]>(this.apiUrl);
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
}
