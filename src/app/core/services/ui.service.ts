import { Injectable } from '@angular/core';
import { LoadingController, ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class UiService {
  private activeRequests = 0;
  private loader: HTMLIonLoadingElement | null = null;
  private isCreatingLoader = false;

  constructor(
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  async showLoader() {
    this.activeRequests++;
    
    if (this.activeRequests === 1 && !this.loader && !this.isCreatingLoader) {
      this.isCreatingLoader = true;
      try {
        this.loader = await this.loadingCtrl.create({
          spinner: 'crescent',
          message: 'Завантаження...',
          translucent: true,
          backdropDismiss: false
        });
        
        // Check if requests were cancelled/completed while creating
        if (this.activeRequests > 0) {
          await this.loader.present();
        } else {
          await this.loader.dismiss();
          this.loader = null;
        }
      } finally {
        this.isCreatingLoader = false;
      }
    }
  }

  async hideLoader() {
    this.activeRequests--;
    if (this.activeRequests < 0) {
      this.activeRequests = 0;
    }
    
    if (this.activeRequests === 0) {
      if (this.loader && !this.isCreatingLoader) {
        await this.loader.dismiss();
        this.loader = null;
      }
    }
  }

  async showErrorToast(message: string = 'Виникла помилка. Спробуйте ще раз.') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color: 'danger',
      position: 'bottom',
      buttons: [
        {
          text: 'ОК',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}
