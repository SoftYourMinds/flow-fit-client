import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonicModule,
  AlertController,
  ModalController,
  ToastController,
  IonItemSliding,
  ViewWillEnter,
} from '@ionic/angular';
import { ClientsService, Client } from '../../core/services/clients.service';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ClientModalComponent } from '../../shared/modals/client-modal/client-modal.component';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss'],
})
export class ClientsComponent implements OnInit, ViewWillEnter {
  private readonly clientsService = inject(ClientsService);
  private readonly alertController = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);

  clients = signal<Client[]>([]);
  archivedClients = signal<Client[]>([]);
  showArchived = signal<boolean>(false);
  searchQuery = signal('');
  isLoading = signal(true);

  ngOnInit() {
    this.loadClients();
  }

  ionViewWillEnter() {
    this.loadClients();
  }

  loadClients(event?: CustomEvent) {
    if (!event) this.isLoading.set(true);
    const query = this.searchQuery();

    this.clientsService.getAll(query).subscribe({
      next: (data) => {
        this.clients.set(data || []);
        if (!event) this.isLoading.set(false);
        (event?.target as { complete?: () => void } | null)?.complete?.();
      },
      error: () => {
        if (!event) this.isLoading.set(false);
        (event?.target as { complete?: () => void } | null)?.complete?.();
      },
    });

    this.clientsService.getArchived(query).subscribe({
      next: (archived) => {
        const list = archived || [];
        this.archivedClients.set(list);
        if (list.length === 0 && this.showArchived()) {
          this.showArchived.set(false);
        }
      },
      error: () => {},
    });
  }

  handleRefresh(event: CustomEvent) {
    this.loadClients(event);
  }

  onSearch(event: CustomEvent) {
    this.searchQuery.set(event.detail.value || '');
    this.loadClients();
  }

  toggleArchivedView() {
    this.showArchived.set(!this.showArchived());
  }

  openClientCabinet(client: Client) {
    this.router.navigate(['/tabs/clients', client.id]);
  }

  async archiveClient(client: Client, slidingItem?: IonItemSliding) {
    if (slidingItem) await slidingItem.close();
    this.clientsService.archive(client.id).subscribe({
      next: async () => {
        this.loadClients();
        await this.showToast(`«${client.fullName}» перенесено в архів`, 'medium');
      },
      error: async () => {
        await this.showToast('Не вдалося архівувати клієнта', 'danger');
      },
    });
  }

  async restoreClient(client: Client, slidingItem?: IonItemSliding) {
    if (slidingItem) await slidingItem.close();
    this.clientsService.restore(client.id).subscribe({
      next: async () => {
        this.loadClients();
        await this.showToast(`«${client.fullName}» відновлено з архіву`, 'success');
      },
      error: async () => {
        await this.showToast('Не вдалося відновити клієнта', 'danger');
      },
    });
  }

  async confirmDeleteClient(client: Client, slidingItem?: IonItemSliding) {
    if (slidingItem) await slidingItem.close();
    const alert = await this.alertController.create({
      header: 'Видалити клієнта?',
      message: `Профіль «${client.fullName}» буде видалено зі списку, а публічне посилання вимкнено. Історія минулих тренувань та звіти збережуться.`,
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Видалити',
          role: 'destructive',
          handler: () => {
            this.clientsService.deleteClient(client.id).subscribe({
              next: async () => {
                this.loadClients();
                await this.showToast(`Клієнта «${client.fullName}» видалено`, 'medium');
              },
              error: async () => {
                await this.showToast('Не вдалося видалити клієнта', 'danger');
              },
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async createClient() {
    const modal = await this.modalCtrl.create({
      component: ClientModalComponent,
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {
      this.clientsService
        .create({
          fullName: data.fullName,
          phone: data.phone,
          goal: data.goal,
        })
        .subscribe(() => this.loadClients());
    }
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
