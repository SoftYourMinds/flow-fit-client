import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { ClientsService } from '../../../core/services/clients.service';

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

  constructor(
    private route: ActivatedRoute,
    private clientsService: ClientsService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadClient(+id);
    }
  }

  loadClient(id: number) {
    this.isLoading.set(true);
    this.clientsService.getOne(id).subscribe({
      next: (data) => {
        this.client.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  setTab(tab: any) {
    this.selectedTab.set(tab);
  }

  async addNote() {
    const alert = await this.alertController.create({
      header: 'Нова нотатка',
      inputs: [
        { name: 'text', type: 'textarea', placeholder: 'Текст нотатки...' },
        { name: 'link', type: 'url', placeholder: 'Посилання (напр. Google Диск, тренування)' }
      ],
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Зберегти',
          handler: (data) => {
            if (data.text) {
              const links = data.link ? [data.link] : [];
              this.clientsService.addNote(this.client().id, { text: data.text, links })
                .subscribe(() => this.loadClient(this.client().id));
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async addMetric() {
    const alert = await this.alertController.create({
      header: 'Нові заміри',
      inputs: [
        { name: 'weight', type: 'number', placeholder: 'Вага (кг)' },
        { name: 'bodyFatPercentage', type: 'number', placeholder: 'Відсоток жиру (%)' }
      ],
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Зберегти',
          handler: (data) => {
            if (data.weight || data.bodyFatPercentage) {
              this.clientsService.addMetric(this.client().id, {
                weight: data.weight ? +data.weight : undefined,
                bodyFatPercentage: data.bodyFatPercentage ? +data.bodyFatPercentage : undefined
              }).subscribe(() => this.loadClient(this.client().id));
            }
          }
        }
      ]
    });
    await alert.present();
  }
}
