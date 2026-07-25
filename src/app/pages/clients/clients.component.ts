import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ModalController } from '@ionic/angular';
import { ClientsService, Client } from '../../core/services/clients.service';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ClientSheetModalComponent } from '../../shared/modals/client-sheet-modal/client-sheet-modal.component';
import { ClientModalComponent } from '../../shared/modals/client-modal/client-modal.component';

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

  openClientCabinet(client: Client) {
    this.router.navigate(['/tabs/clients', client.id]);
  }

  async createClient() {
    const modal = await this.modalCtrl.create({
      component: ClientModalComponent
    });
    
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    
    if (role === 'confirm' && data) {
      this.clientsService.create({
        fullName: data.fullName,
        phone: data.phone,
        goal: data.goal
      }).subscribe(() => this.loadClients());
    }
  }
}
