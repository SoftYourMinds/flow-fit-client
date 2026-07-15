import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-media-viewer-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar style="--background: transparent; position: absolute; top: 0; width: 100%; z-index: 10;">
        <ion-buttons slot="end">
          <ion-button (click)="close()" color="light">
            <ion-icon name="close-outline" style="font-size: 32px;"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content color="dark" class="ion-padding" scroll-y="false">
      <div class="media-container" (click)="close()">
        @if (isVideo(mediaUrl)) {
          <video [src]="mediaUrl" controls autoplay class="full-media" (click)="$event.stopPropagation()"></video>
        } @else {
          <img [src]="mediaUrl" class="full-media" (click)="$event.stopPropagation()" />
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .media-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
      width: 100%;
    }
    .full-media {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    ion-content {
      --background: #000000;
    }
  `]
})
export class MediaViewerModalComponent {
  @Input() mediaUrl!: string;

  constructor(private modalCtrl: ModalController) {}

  isVideo(url: string): boolean {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov)$/i) != null;
  }

  close() {
    this.modalCtrl.dismiss();
  }
}
