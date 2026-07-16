import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TelegramService {
  private readonly apiUrl = environment.apiUrl + '/telegram';

  constructor(private http: HttpClient) {}

  getLinkToken(): Observable<{ token: string }> {
    return this.http.get<{ token: string }>(`${this.apiUrl}/link-token`);
  }
}
