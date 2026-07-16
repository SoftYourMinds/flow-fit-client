import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientsService } from '../../../core/services/clients.service';
import { NoteModalComponent } from '../../../shared/modals/note-modal/note-modal.component';
import { MediaViewerModalComponent } from '../../../shared/modals/media-viewer-modal/media-viewer-modal.component';

@Component({
  selector: 'app-client-details',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class DetailsComponent implements OnInit {
  client = signal<any>(null);
  selectedTab = signal<'notes' | 'metrics' | 'sessions'>('notes');
  isLoading = signal(true);

  upcomingSessions = signal<any[]>([]);
  pastSessions = signal<any[]>([]);

  constructor(
    private route: ActivatedRoute,
    private clientsService: ClientsService,
    private modalCtrl: ModalController,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadClient(+id);
      }
    });
  }

  loadClient(id: number) {
    this.isLoading.set(true);
    this.clientsService.getOne(id).subscribe({
      next: (data) => {
        // Sort metrics from oldest to newest
        if (data.metrics && data.metrics.length > 0) {
          data.metrics = [...data.metrics].sort((a: any, b: any) => {
            const dateA = new Date(a.date || a.createdAt).getTime();
            const dateB = new Date(b.date || b.createdAt).getTime();
            return dateA - dateB;
          });
        }
        
        this.client.set(data);
        
        const now = new Date();
        if (data.participations) {
          const upcoming = data.participations.filter((p: any) => new Date(p.session.startTime) >= now);
          const past = data.participations.filter((p: any) => new Date(p.session.startTime) < now);
          this.upcomingSessions.set(upcoming);
          this.pastSessions.set(past);
        }

        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  setTab(tab: any) {
    this.selectedTab.set(tab);
  }

  async addNote() {
    const modal = await this.modalCtrl.create({
      component: NoteModalComponent
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.clientsService.addNote(this.client().id, data)
        .subscribe(() => this.loadClient(this.client().id));
    }
  }

  async editNote(note: any) {
    const modal = await this.modalCtrl.create({
      component: NoteModalComponent,
      componentProps: { note }
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.clientsService.updateNote(this.client().id, note.id, data)
        .subscribe(() => this.loadClient(this.client().id));
    }
  }

  addMetric() {
    this.router.navigate(['/tabs/clients', this.client().id, 'metrics', 'new']);
  }

  editMetric(metric: any) {
    this.router.navigate(['/tabs/clients', this.client().id, 'metrics', metric.id]);
  }

  async openMedia(url: string) {
    const modal = await this.modalCtrl.create({
      component: MediaViewerModalComponent,
      componentProps: { mediaUrl: url }
    });
    await modal.present();
  }

  isVideo(url: string): boolean {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov)$/i) != null;
  }

  editSession(sessionId: number) {
    this.router.navigate(['/tabs/sessions', sessionId]);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'UPCOMING': return 'primary';
      case 'ACTIVE': return 'warning';
      case 'COMPLETED': return 'success';
      case 'MISSED': return 'danger';
      case 'REQUIRED_ACTION': return 'tertiary';
      default: return 'medium';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'UPCOMING': return 'Заплановано';
      case 'ACTIVE': return 'Триває';
      case 'COMPLETED': return 'Завершено';
      case 'MISSED': return 'Пропущено';
      case 'REQUIRED_ACTION': return 'Потребує дії';
      default: return status;
    }
  }
}
