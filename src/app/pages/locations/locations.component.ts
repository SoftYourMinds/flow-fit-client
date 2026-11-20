import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, IonItemSliding, ModalController } from '@ionic/angular';

import { LocationsService, Location } from '../../core/services/locations.service';
import { LocationModalComponent } from '../../shared/modals/location-modal/location-modal.component';

@Component({
  selector: 'app-locations',
  imports: [CommonModule, IonicModule],
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationsComponent implements OnInit {
  private readonly locationsService = inject(LocationsService);
  private readonly modalCtrl = inject(ModalController);

  readonly locations = signal<Location[]>([]);
  readonly isLoading = signal<boolean>(true);

  // ─── Lifecycle ─────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadLocations();
  }

  // ─── Public Methods ────────────────────────────────────────────

  loadLocations(event?: CustomEvent): void {
    if (!event) {
      this.isLoading.set(true);
    }

    this.locationsService.getAll().subscribe({
      next: (data) => {
        this.locations.set(data);
        if (!event) {
          this.isLoading.set(false);
        }
        (event?.target as { complete?: () => void } | null)?.complete?.();
      },
      error: () => {
        if (!event) {
          this.isLoading.set(false);
        }
        (event?.target as { complete?: () => void } | null)?.complete?.();
      },
    });
  }

  handleRefresh(event: CustomEvent): void {
    this.loadLocations(event);
  }

  deleteLocation(id: number): void {
    this.locationsService.remove(id).subscribe(() => this.loadLocations());
  }

  async createLocation(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: LocationModalComponent,
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.locationsService
        .create({
          name: data.name,
          address: data.address,
          type: data.type,
          maxParticipants: data.maxParticipants,
        })
        .subscribe(() => this.loadLocations());
    }
  }

  async editLocation(location: Location, slidingItem?: IonItemSliding): Promise<void> {
    if (slidingItem) {
      await slidingItem.close();
    }

    const modal = await this.modalCtrl.create({
      component: LocationModalComponent,
      componentProps: { location },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.locationsService
        .update(location.id, {
          name: data.name,
          address: data.address,
          type: data.type,
          maxParticipants: data.maxParticipants,
        })
        .subscribe(() => this.loadLocations());
    }
  }
}
