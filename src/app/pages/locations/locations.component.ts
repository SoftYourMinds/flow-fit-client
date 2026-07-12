import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
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

  constructor(private locationsService: LocationsService) {}

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
}
