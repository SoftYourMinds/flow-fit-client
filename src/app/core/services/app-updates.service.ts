import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ModalController } from '@ionic/angular';
import { Observable, tap, of, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WhatsNewModalComponent } from '../../components/whats-new-modal/whats-new-modal.component';

export interface AppUpdateGroup {
  category: string;
  items: string[];
}

export interface AppReleaseUpdate {
  version: string;
  title: string;
  releaseDate: string;
  badge?: string;
  highlights: string[];
  groups: AppUpdateGroup[];
}

@Injectable({
  providedIn: 'root'
})
export class AppUpdatesService {
  private readonly http = inject(HttpClient);
  private readonly modalCtrl = inject(ModalController);

  private readonly apiUrl = `${environment.apiUrl}/app-updates`;
  private readonly STORAGE_KEY = 'flowfit_last_seen_version';

  readonly latestUpdate = signal<AppReleaseUpdate | null>(null);
  readonly pendingUpdateToShow = signal<AppReleaseUpdate | null>(null);

  /**
   * Викликається паралельно під час прелоадера (AppInitService)
   */
  checkUpdatesDuringPreload(): Observable<AppReleaseUpdate | null> {
    return this.http.get<AppReleaseUpdate>(`${this.apiUrl}/latest`, {
      headers: { 'x-silent-request': 'true' }
    }).pipe(
      tap((update) => {
        if (!update) return;
        this.latestUpdate.set(update);

        const lastSeen = localStorage.getItem(this.STORAGE_KEY);
        if (update.version !== lastSeen) {
          this.pendingUpdateToShow.set(update);
        }
      }),
      catchError(() => of(null))
    );
  }

  getAllUpdates(): Observable<AppReleaseUpdate[]> {
    return this.http.get<AppReleaseUpdate[]>(this.apiUrl);
  }

  /**
   * Відкриває модалку оновлень після завершення лоадера
   */
  async triggerPendingModalIfAvailable(): Promise<void> {
    const update = this.pendingUpdateToShow();
    if (!update) return;

    const modal = await this.modalCtrl.create({
      component: WhatsNewModalComponent,
      componentProps: { update },
      breakpoints: [0, 0.85, 1],
      initialBreakpoint: 0.85,
      handle: true,
      cssClass: 'whats-new-modal-sheet'
    });

    await modal.present();
    this.markAsSeen(update.version);
  }

  markAsSeen(version: string): void {
    localStorage.setItem(this.STORAGE_KEY, version);
    this.pendingUpdateToShow.set(null);
  }
}
