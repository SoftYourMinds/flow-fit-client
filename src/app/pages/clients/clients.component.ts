import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ModalController } from '@ionic/angular';
import { ClientsService, Client } from '../../core/services/clients.service';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ClientSheetModalComponent } from '../../shared/modals/client-sheet-modal/client-sheet-modal.component';

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
    private alertController: AlertController,
    private modalCtrl: ModalController,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadClients();
  }

  loadClients(event?: any) {
    if (!event) this.isLoading.set(true);
    this.clientsService.getAll(this.searchQuery()).subscribe({
      next: (data) => {
        this.clients.set(data);
        if (!event) this.isLoading.set(false);
        if (event) event.target.complete();
      },
      error: () => {
        if (!event) this.isLoading.set(false);
        if (event) event.target.complete();
      }
    });
  }

  handleRefresh(event: any) {
    this.loadClients(event);
  }

  onSearch(event: any) {
    this.searchQuery.set(event.detail.value || '');
    this.loadClients();
  }

  async openClientCabinet(client: Client) {
    const modal = await this.modalCtrl.create({
      component: ClientSheetModalComponent,
      componentProps: {
        clientId: client.id
      },
      breakpoints: [0, 0.5, 0.9],
      initialBreakpoint: 0.85,
      handle: true,
      cssClass: 'client-bottom-sheet'
    });

    modal.addEventListener('ionBreakpointDidChange', (ev: any) => {
      if (ev.detail.breakpoint === 0.9) {
        modal.dismiss();
        this.router.navigate(['/tabs/clients', client.id]);
      }
    });

    await modal.present();
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
