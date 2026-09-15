import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

import { ClientSubscription } from '../../../core/services/subscriptions.service';

@Component({
  selector: 'app-subscription-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './subscription-modal.component.html',
  styleUrls: ['./subscription-modal.component.scss'],
})
export class SubscriptionModalComponent implements OnInit {
  private readonly modalCtrl = inject(ModalController);

  @Input() clientId!: number;
  @Input() subscription?: ClientSubscription;

  type = signal<'SESSIONS_BASED' | 'DATE_RANGE'>('SESSIONS_BASED');
  totalSessions = signal<number>(8);
  startDate = signal<string>(new Date().toISOString());
  endDate = signal<string>(this.getDefaultEndDate());
  price = signal<number>(0);
  isPaid = signal<boolean>(false);

  protected readonly isEditing = signal(false);

  // ─── Lifecycle ────────────────────────────────────────────────────

  ngOnInit(): void {
    if (!this.subscription) return;

    this.isEditing.set(true);
    this.type.set(this.subscription.type);
    this.totalSessions.set(this.subscription.totalSessions ?? 8);
    if (this.subscription.startDate) this.startDate.set(this.subscription.startDate);
    if (this.subscription.endDate) this.endDate.set(this.subscription.endDate);
    this.price.set(this.subscription.price);
    this.isPaid.set(this.subscription.isPaid);
  }

  // ─── Public Methods ─────────────────────────────────────────────

  cancel(): Promise<boolean> {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm(): Promise<boolean> {
    const data: Record<string, unknown> = {
      clientId: this.clientId,
      type: this.type(),
      price: this.price(),
      isPaid: this.isPaid(),
    };

    if (this.type() === 'SESSIONS_BASED') {
      data['totalSessions'] = this.totalSessions();
    } else {
      data['startDate'] = this.startDate();
      data['endDate'] = this.endDate();
    }

    return this.modalCtrl.dismiss(data, 'confirm');
  }

  onTypeChange(event: CustomEvent): void {
    this.type.set(event.detail.value);
  }

  onTotalSessionsChange(event: CustomEvent): void {
    this.totalSessions.set(Number(event.detail.value));
  }

  onStartDateChange(event: CustomEvent): void {
    this.startDate.set(event.detail.value);
  }

  onEndDateChange(event: CustomEvent): void {
    this.endDate.set(event.detail.value);
  }

  onPriceChange(event: CustomEvent): void {
    this.price.set(Number(event.detail.value));
  }

  onIsPaidChange(event: CustomEvent): void {
    this.isPaid.set(event.detail.checked);
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private getDefaultEndDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString();
  }
}
