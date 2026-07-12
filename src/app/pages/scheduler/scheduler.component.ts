import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ModalController } from '@ionic/angular';
import { SessionsService, WorkoutSession } from '../../core/services/sessions.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  templateUrl: './scheduler.component.html',
  styleUrls: ['./scheduler.component.scss']
})
export class SchedulerComponent implements OnInit {
  sessions = signal<WorkoutSession[]>([]);
  isLoading = signal(true);
  
  // Quick date filter
  selectedDate = signal(new Date().toISOString());

  // Computed grouped sessions by date (simple grouping)
  groupedSessions = computed(() => {
    const list = this.sessions();
    const map = new Map<string, WorkoutSession[]>();
    for (const session of list) {
      const dateStr = new Date(session.startTime).toLocaleDateString();
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(session);
    }
    return Array.from(map.entries()).map(([date, sessions]) => ({ date, sessions }));
  });

  constructor(
    private sessionsService: SessionsService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadSessions();
  }

  loadSessions() {
    this.isLoading.set(true);
    // Fetch a wide range or based on selectedDate. For now, fetch all for demo.
    this.sessionsService.getAll().subscribe({
      next: (data) => {
        this.sessions.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  dateChanged(event: any) {
    this.selectedDate.set(event.detail.value);
    // In a real app, refetch sessions for this week/month.
  }

  async createSession() {
    const alert = await this.alertController.create({
      header: 'Нове заняття',
      inputs: [
        { name: 'startTime', type: 'datetime-local', placeholder: 'Час початку' },
        { name: 'endTime', type: 'datetime-local', placeholder: 'Час завершення' },
        { name: 'type', type: 'text', placeholder: 'Тип (INDIVIDUAL / GROUP)', value: 'INDIVIDUAL' },
        { name: 'locationId', type: 'number', placeholder: 'ID локації (напр. 1)' },
        { name: 'pricePerPerson', type: 'number', placeholder: 'Ціна за людину' }
      ],
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Створити',
          handler: (data) => {
            this.sessionsService.create({
              startTime: data.startTime,
              endTime: data.endTime,
              type: data.type,
              locationId: +data.locationId,
              pricePerPerson: +data.pricePerPerson,
              status: 'UPCOMING'
            }).subscribe(() => this.loadSessions());
          }
        }
      ]
    });
    await alert.present();
  }

  async addParticipant(sessionId: number) {
    const alert = await this.alertController.create({
      header: 'Додати учасника',
      inputs: [
        { name: 'clientId', type: 'number', placeholder: 'ID Клієнта (якщо є)' },
        { name: 'customName', type: 'text', placeholder: "Або введіть ім'я (якщо немає)" }
      ],
      buttons: [
        { text: 'Скасувати', role: 'cancel' },
        {
          text: 'Додати',
          handler: (data) => {
            const payload: any = {};
            if (data.clientId) payload.clientId = +data.clientId;
            if (data.customName) payload.customName = data.customName;
            this.sessionsService.addParticipant(sessionId, payload)
              .subscribe(() => this.loadSessions());
          }
        }
      ]
    });
    await alert.present();
  }

  deleteSession(id: number) {
    this.sessionsService.delete(id).subscribe(() => this.loadSessions());
  }
}
