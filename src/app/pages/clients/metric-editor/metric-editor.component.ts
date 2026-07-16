import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientsService } from '../../../core/services/clients.service';
import { StorageService } from '../../../core/services/storage.service';
import { QuillModule } from 'ngx-quill';
import { MediaViewerModalComponent } from '../../../shared/modals/media-viewer-modal/media-viewer-modal.component';

@Component({
  selector: 'app-metric-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, QuillModule],
  templateUrl: './metric-editor.component.html',
  styleUrls: ['./metric-editor.component.scss']
})
export class MetricEditorComponent implements OnInit {
  clientId: number | null = null;
  metricId: number | null = null;
  
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Form Fields
  date: string = new Date().toISOString();
  weight: number | null = null;
  chest: number | null = null;
  waist: number | null = null;
  belly: number | null = null;
  buttocksTop: number | null = null;
  buttocksBottom: number | null = null;
  legLeft: number | null = null;
  legRight: number | null = null;
  armLeft: number | null = null;
  armRight: number | null = null;
  
  // Legacy fields (optional)
  bodyFatPercentage: number | null = null;

  note: string = '';
  photos: string[] = [];

  isUploading = false;
  isLoading = false;

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'bullet' }]
    ]
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private clientsService: ClientsService,
    private storageService: StorageService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.clientId = Number(params.get('id'));
      const metricIdParam = params.get('metricId');
      
      if (metricIdParam && metricIdParam !== 'new') {
        this.metricId = Number(metricIdParam);
        this.loadMetric();
      }
    });
  }

  loadMetric() {
    if (!this.clientId) return;
    this.isLoading = true;
    this.clientsService.getOne(this.clientId).subscribe({
      next: (clientData) => {
        const metric = clientData.metrics?.find((m: any) => m.id === this.metricId);
        if (metric) {
          this.date = new Date(metric.date || metric.createdAt).toISOString();
          this.weight = metric.weight;
          this.chest = metric.chest;
          this.waist = metric.waist;
          this.belly = metric.belly;
          this.buttocksTop = metric.buttocksTop;
          this.buttocksBottom = metric.buttocksBottom;
          this.legLeft = metric.legLeft;
          this.legRight = metric.legRight;
          this.armLeft = metric.armLeft;
          this.armRight = metric.armRight;
          this.bodyFatPercentage = metric.bodyFatPercentage;
          this.note = metric.note || '';
          this.photos = metric.photos ? [...metric.photos] : [];
        }
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  triggerFileUpload() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.isUploading = true;
      this.storageService.uploadFile(file).subscribe({
        next: (res) => {
          this.photos.push(res.url);
          this.isUploading = false;
        },
        error: (err) => {
          console.error('Failed to upload file', err);
          this.isUploading = false;
        }
      });
    }
    event.target.value = null;
  }

  removePhoto(index: number) {
    this.photos.splice(index, 1);
  }

  isVideo(url: string): boolean {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov)$/i) != null;
  }

  async openMedia(url: string) {
    const modal = await this.modalCtrl.create({
      component: MediaViewerModalComponent,
      componentProps: { mediaUrl: url }
    });
    await modal.present();
  }

  trackByIndex(index: number): number {
    return index;
  }

  goBack() {
    this.location.back();
  }

  save() {
    if (!this.clientId) return;

    const data = {
      date: new Date(this.date).toISOString(),
      weight: this.weight ? +this.weight : undefined,
      chest: this.chest ? +this.chest : undefined,
      waist: this.waist ? +this.waist : undefined,
      belly: this.belly ? +this.belly : undefined,
      buttocksTop: this.buttocksTop ? +this.buttocksTop : undefined,
      buttocksBottom: this.buttocksBottom ? +this.buttocksBottom : undefined,
      legLeft: this.legLeft ? +this.legLeft : undefined,
      legRight: this.legRight ? +this.legRight : undefined,
      armLeft: this.armLeft ? +this.armLeft : undefined,
      armRight: this.armRight ? +this.armRight : undefined,
      bodyFatPercentage: this.bodyFatPercentage ? +this.bodyFatPercentage : undefined,
      note: this.note.trim() || undefined,
      photos: this.photos
    };

    if (this.metricId) {
      this.clientsService.updateMetric(this.clientId, this.metricId, data).subscribe({
        next: () => this.goBack(),
        error: (err) => console.error('Failed to update metric', err)
      });
    } else {
      this.clientsService.addMetric(this.clientId, data).subscribe({
        next: () => this.goBack(),
        error: (err) => console.error('Failed to add metric', err)
      });
    }
  }
}
