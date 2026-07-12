import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { LocationsService, Location } from '../../core/services/locations.service';

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
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadLocations();
  }

  loadLocations() {
    this.isLoading.set(true);
    this.locationsService.getAll().subscribe({
      next: (data) => {
        this.locations.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  deleteLocation(id: number) {
    this.locationsService.remove(id).subscribe(() => this.loadLocations());
  }

  async createLocation() {
    const alert = await this.alertController.create({
      header: 'Нова локація',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Назва (напр. Зал на Оболоні)' },
        { name: 'address', type: 'text', placeholder: 'Адреса' },
        { name: 'type', type: 'text', value: 'STUDIO', placeholder: 'Тип (STUDIO / GYM)' }
      ],
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Створити',
          handler: (data) => {
            if (data.name) {
              this.locationsService.create({
                name: data.name,
                address: data.address,
                type: data.type
              }).subscribe(() => this.loadLocations());
            }
          }
        }
      ]
    });
    await alert.present();
  }
}
