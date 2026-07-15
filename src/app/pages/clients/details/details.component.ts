import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientsService } from '../../../core/services/clients.service';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { NoteModalComponent } from '../../../shared/modals/note-modal/note-modal.component';
import { MetricModalComponent } from '../../../shared/modals/metric-modal/metric-modal.component';
import { MediaViewerModalComponent } from '../../../shared/modals/media-viewer-modal/media-viewer-modal.component';

@Component({
  selector: 'app-client-details',
  standalone: true,
  imports: [CommonModule, IonicModule, BaseChartDirective],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class DetailsComponent implements OnInit {
  client = signal<any>(null);
  selectedTab = signal<'notes' | 'metrics' | 'sessions'>('notes');
  isLoading = signal(true);

  upcomingSessions = signal<any[]>([]);
  pastSessions = signal<any[]>([]);

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Вага (кг)',
        fill: false,
        tension: 0.1,
        borderColor: '#C88A72',
        backgroundColor: '#C88A72'
      }
    ]
  };
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
  };

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
        this.client.set(data);
        
        const now = new Date();
        if (data.participations) {
          const upcoming = data.participations.filter((p: any) => new Date(p.session.startTime) >= now);
          const past = data.participations.filter((p: any) => new Date(p.session.startTime) < now);
          this.upcomingSessions.set(upcoming);
          this.pastSessions.set(past);
        }

        if (data.metrics && data.metrics.length > 0) {
          const sortedMetrics = [...data.metrics].reverse();
          this.lineChartData = {
            labels: sortedMetrics.map(m => new Date(m.createdAt).toLocaleDateString()),
            datasets: [
              {
                ...this.lineChartData.datasets[0],
                data: sortedMetrics.map(m => m.weight)
              }
            ]
          };
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

  async addMetric() {
    const modal = await this.modalCtrl.create({
      component: MetricModalComponent
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.clientsService.addMetric(this.client().id, data)
        .subscribe(() => this.loadClient(this.client().id));
    }
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
}
