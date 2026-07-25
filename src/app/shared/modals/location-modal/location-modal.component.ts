import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Location } from '../../../core/services/locations.service';

@Component({
  selector: 'app-location-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './location-modal.component.html',
  styleUrls: ['./location-modal.component.scss']
})
export class LocationModalComponent {
  @Input() location?: Location;

  name = signal<string>('');
  address = signal<string>('');
  type = signal<'STUDIO' | 'GYM' | 'OUTDOOR'>('STUDIO');

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    if (this.location) {
      this.name.set(this.location.name || '');
      this.address.set(this.location.address || '');
      this.type.set(this.location.type || 'STUDIO');
    }
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    if (!this.name()) return;
    
    return this.modalCtrl.dismiss({
      name: this.name(),
      address: this.address(),
      type: this.type()
    }, 'confirm');
  }
}
