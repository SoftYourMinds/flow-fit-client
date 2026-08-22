import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AppInitService } from '../../../core/services/app-init.service';

@Component({
  selector: 'app-splash-loader',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './splash-loader.component.html',
  styleUrls: ['./splash-loader.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SplashLoaderComponent {
  readonly appInitService = inject(AppInitService);

  // ─── Public Methods ─────────────────────────────────────────────

  onRetry(): void {
    this.appInitService.retry();
  }

  onSkip(): void {
    this.appInitService.skipToApp();
  }
}
