import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { AppReleaseUpdate } from '../../core/services/app-updates.service';

@Component({
  selector: 'app-whats-new-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './whats-new-modal.component.html',
  styleUrls: ['./whats-new-modal.component.scss']
})
export class WhatsNewModalComponent {
  private modalCtrl = inject(ModalController);

  @Input() update!: AppReleaseUpdate;

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
