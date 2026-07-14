import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { ClientsService, Client } from '../../../core/services/clients.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-client-sheet-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
  templateUrl: './client-sheet-modal.component.html',
  styleUrls: ['./client-sheet-modal.component.scss']
})
export class ClientSheetModalComponent implements OnInit {
  @Input() clientId!: number;
  
  client = signal<any>(null);
  isLoading = signal(true);
  
  upcomingSessions = signal<any[]>([]);

  constructor(
    private modalCtrl: ModalController,
    private clientsService: ClientsService
  ) {}

  ngOnInit() {
    this.loadClientData();
  }

  loadClientData() {
    this.isLoading.set(true);
    this.clientsService.getOne(this.clientId).subscribe({
      next: (data: any) => {
        this.client.set(data);
        
        const now = new Date();
        if (data.participations) {
          const upcoming = data.participations.filter((p: any) => new Date(p.session.startTime) >= now);
          this.upcomingSessions.set(upcoming);
        }
        
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  close() {
    this.modalCtrl.dismiss();
  }
}
