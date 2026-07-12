import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { ClientsService, Client } from '../../core/services/clients.service';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss']
})
export class ClientsComponent implements OnInit {
  clients = signal<Client[]>([]);
  searchQuery = signal('');
  isLoading = signal(true);

  constructor(
    private clientsService: ClientsService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadClients();
  }

  loadClients() {
    this.isLoading.set(true);
    this.clientsService.getAll(this.searchQuery()).subscribe({
      next: (data) => {
        this.clients.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onSearch(event: any) {
    this.searchQuery.set(event.detail.value || '');
    this.loadClients();
  }

  async createClient() {
    const alert = await this.alertController.create({
      header: 'Новий клієнт',
      inputs: [
        { name: 'fullName', type: 'text', placeholder: 'ПІБ клієнта' },
        { name: 'phone', type: 'tel', placeholder: 'Номер телефону' },
        { name: 'goal', type: 'text', placeholder: 'Ціль (напр. схуднення)' }
      ],
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Створити',
          handler: (data) => {
            if (data.fullName) {
              this.clientsService.create({
                fullName: data.fullName,
                phone: data.phone,
                goal: data.goal
              }).subscribe(() => this.loadClients());
            }
          }
        }
      ]
    });
    await alert.present();
  }
}
