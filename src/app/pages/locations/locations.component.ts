import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ModalController } from '@ionic/angular';
import { LocationsService, Location } from '../../core/services/locations.service';
import { LocationModalComponent } from '../../shared/modals/location-modal/location-modal.component';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.scss']
})
export class LocationsComponent implements OnInit {
  locations = signal<Location[]>([]);
  isLoading = signal(true);

  constructor(
    private locationsService: LocationsService,
    private alertController: AlertController,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.loadLocations();
  }

  loadLocations(event?: any) {
    if (!event) this.isLoading.set(true);
    this.locationsService.getAll().subscribe({
      next: (data) => {
        this.locations.set(data);
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
    this.loadLocations(event);
  }

  deleteLocation(id: number) {
    this.locationsService.remove(id).subscribe(() => this.loadLocations());
  }

  async createLocation() {
    const modal = await this.modalCtrl.create({
      component: LocationModalComponent
    });
    
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    
    if (role === 'confirm' && data) {
      this.locationsService.create({
        name: data.name,
        address: data.address,
        type: data.type
      }).subscribe(() => this.loadLocations());
    }
  }
}
