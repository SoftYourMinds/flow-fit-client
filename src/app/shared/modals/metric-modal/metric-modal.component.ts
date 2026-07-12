import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-metric-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './metric-modal.component.html',
  styleUrls: ['./metric-modal.component.scss']
})
export class MetricModalComponent {
  weight: number | null = null;
  bodyFatPercentage: number | null = null;
  measurements: string = '';
  note: string = '';

  constructor(private modalCtrl: ModalController) {}

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    if (!this.weight && !this.bodyFatPercentage && !this.measurements.trim()) return;
    return this.modalCtrl.dismiss({
      weight: this.weight ? +this.weight : undefined,
      bodyFatPercentage: this.bodyFatPercentage ? +this.bodyFatPercentage : undefined,
      measurements: this.measurements.trim() || undefined,
      note: this.note.trim() || undefined
    }, 'confirm');
  }
}
