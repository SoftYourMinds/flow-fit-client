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
    
    if (this.activeRequests === 1) {
      // Delay to prevent flickering for very fast requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if ((this.activeRequests as number) === 0) {
        return; // Request finished during the delay
      }

      if (!this.loader && !this.isCreatingLoader) {
        this.isCreatingLoader = true;
        try {
          this.loader = await this.loadingCtrl.create({
            spinner: 'crescent',
            message: 'Завантаження...',
            translucent: true,
            backdropDismiss: false
          });

          if (this.activeRequests > 0) {
            await this.loader.present();
            // Double check if requests finished during the present animation
            if ((this.activeRequests as number) === 0) {
              await this.dismissLoader();
            }
          } else {
            await this.dismissLoader();
          }
        } catch (error) {
          console.error('[UiService] Error creating loader:', error);
          this.loader = null;
        } finally {
          this.isCreatingLoader = false;
        }
      }
    }
  }

  async hideLoader() {
    this.activeRequests--;
    if (this.activeRequests <= 0) {
      this.activeRequests = 0;
      
      if (this.loader && !this.isCreatingLoader) {
        await this.dismissLoader();
      }
    }
  }

  private async dismissLoader() {
    if (this.loader) {
      try {
        await this.loader.dismiss();
      } catch (e) {
        console.warn('[UiService] Loader already dismissed or error dismissing:', e);
      }
      this.loader = null;
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
