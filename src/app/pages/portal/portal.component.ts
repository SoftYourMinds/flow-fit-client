import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-portal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './portal.component.html',
  styleUrls: ['./portal.component.scss']
})
export class PortalComponent implements OnInit {
  profile = signal<any>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const token = params.get('token');
      if (token) {
        this.loadProfile(token);
      } else {
        this.error.set('Невірне посилання.');
        this.isLoading.set(false);
      }
    });
  }

  loadProfile(token: string) {
    this.isLoading.set(true);
    this.error.set(null);
    this.http.get(`${environment.apiUrl}/portal/client/${token}`).subscribe({
      next: (data) => {
        this.profile.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Профіль не знайдено або він недоступний.');
        this.isLoading.set(false);
      }
    });
  }
}
