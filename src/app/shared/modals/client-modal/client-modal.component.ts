import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Client } from '../../../core/services/clients.service';

@Component({
  selector: 'app-client-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './client-modal.component.html',
  styleUrls: ['./client-modal.component.scss']
})
export class ClientModalComponent {
  @Input() client?: Client;

  fullName = signal<string>('');
  phone = signal<string>('');
  goal = signal<string>('');

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    if (this.client) {
      this.fullName.set(this.client.fullName || '');
      this.phone.set(this.client.phone || '');
      this.goal.set(this.client.goal || '');
    }
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    if (!this.fullName()) return;
    
    return this.modalCtrl.dismiss({
      fullName: this.fullName(),
      phone: this.phone(),
      goal: this.goal()
    }, 'confirm');
  }
}
