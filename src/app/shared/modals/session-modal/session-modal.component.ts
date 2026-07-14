import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { LocationsService, Location } from '../../../core/services/locations.service';

@Component({
  selector: 'app-session-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './session-modal.component.html',
  styleUrls: ['./session-modal.component.scss']
})
export class SessionModalComponent implements OnInit {
  @Input() locations: Location[] = [];

  locationId: number | null = null;
  type: 'INDIVIDUAL' | 'GROUP' = 'INDIVIDUAL';
  startTime: string = new Date().toISOString();
  duration: number = 50;
  pricePerPerson: number = 300;

  constructor(
    private modalCtrl: ModalController,
    private locationsService: LocationsService
  ) {}

  ngOnInit() {
    if (!this.locations || this.locations.length === 0) {
      this.locationsService.getAll().subscribe({
        next: (locs) => {
          this.locations = locs;
          if (locs.length > 0) {
            this.locationId = locs[0].id;
          }
        }
      });
    } else if (this.locations.length > 0) {
      this.locationId = this.locations[0].id;
    }
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    if (!this.locationId) return;
    
    // Розрахунок часу завершення
    const start = new Date(this.startTime);
    const end = new Date(start.getTime() + this.duration * 60000);

    return this.modalCtrl.dismiss({
      locationId: +this.locationId,
      type: this.type,
      startTime: this.startTime,
      endTime: end.toISOString(),
      pricePerPerson: +this.pricePerPerson,
      status: 'UPCOMING'
    }, 'confirm');
  }
}
