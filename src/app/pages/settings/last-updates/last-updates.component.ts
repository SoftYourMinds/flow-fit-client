import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AppUpdatesService, AppReleaseUpdate } from '../../../core/services/app-updates.service';

@Component({
  selector: 'app-last-updates',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './last-updates.component.html',
  styleUrls: ['./last-updates.component.scss']
})
export class LastUpdatesComponent implements OnInit {
  private updatesService = inject(AppUpdatesService);

  readonly updates = signal<AppReleaseUpdate[]>([]);
  readonly isLoading = signal<boolean>(true);

  ngOnInit(): void {
    this.updatesService.getAllUpdates().subscribe({
      next: (list) => {
        this.updates.set(list);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }
}
