import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { ClientsService } from '../../../core/services/clients.service';

@Component({
  selector: 'app-client-details',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class DetailsComponent implements OnInit {
  client = signal<any>(null);
  selectedTab = signal<'notes' | 'metrics' | 'sessions'>('notes');
  isLoading = signal(true);

  constructor(private route: ActivatedRoute, private clientsService: ClientsService) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadClient(+id);
    }
  }

  loadClient(id: number) {
    this.isLoading.set(true);
    this.clientsService.getOne(id).subscribe({
      next: (data) => {
        this.client.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  setTab(tab: any) {
    this.selectedTab.set(tab);
  }
}
