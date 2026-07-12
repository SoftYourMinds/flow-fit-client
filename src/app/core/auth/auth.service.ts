import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  email: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl + '/auth';

  // State
  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);

  constructor(private http: HttpClient) {
    this.checkAuthOnLoad();
  }

  private checkAuthOnLoad() {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.isAuthenticated.set(true);
      // Ideally decode JWT to get user info or fetch /me
      this.http.get<User>(`${this.apiUrl}/me`).subscribe({
        next: (user) => this.currentUser.set(user),
        error: () => this.logout()
      });
    }
  }

  login(credentials: any) {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => this.handleAuthResponse(res))
    );
  }

  register(data: any) {
    return this.http.post<any>(`${this.apiUrl}/register`, data).pipe(
      tap(res => this.handleAuthResponse(res))
    );
  }

  refreshToken() {
    const refresh_token = localStorage.getItem('refresh_token');
    if (!refresh_token) {
      this.logout();
      return throwError(() => new Error('No refresh token'));
    }

    return this.http.post<any>(`${this.apiUrl}/refresh`, {}, {
      headers: { Authorization: `Bearer ${refresh_token}` }
    }).pipe(
      tap(res => this.handleAuthResponse(res)),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
  }

  private handleAuthResponse(res: { accessToken: string, refreshToken: string }) {
    localStorage.setItem('access_token', res.accessToken);
    localStorage.setItem('refresh_token', res.refreshToken);
    this.isAuthenticated.set(true);
    this.http.get<User>(`${this.apiUrl}/me`).subscribe(user => this.currentUser.set(user));
  }
}
