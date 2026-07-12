import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { ClientsService, Client } from '../../../core/services/clients.service';

@Component({
  selector: 'app-participant-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './participant-modal.component.html',
  styleUrls: ['./participant-modal.component.scss']
})
export class ParticipantModalComponent implements OnInit {
  @Input() clients: Client[] = [];

  mode: 'existing' | 'custom' = 'existing';
  selectedClientId: number | null = null;
  customName: string = '';

  constructor(
    private modalCtrl: ModalController,
    private clientsService: ClientsService
  ) {}

  ngOnInit() {
    if (!this.clients || this.clients.length === 0) {
      this.clientsService.getAll().subscribe({
        next: (cList) => {
          this.clients = cList;
          if (cList.length > 0) {
            this.selectedClientId = cList[0].id;
          }
        }
      });
    } else if (this.clients.length > 0) {
      this.selectedClientId = this.clients[0].id;
    }
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    if (this.mode === 'existing') {
      if (!this.selectedClientId) return;
      return this.modalCtrl.dismiss({ clientId: +this.selectedClientId }, 'confirm');
    } else {
      if (!this.customName.trim()) return;
      return this.modalCtrl.dismiss({ customName: this.customName.trim() }, 'confirm');
    }
  }
}
