import { Component } from '@angular/core';
import { ActionSheetController, NavController } from '@ionic/angular';
import { ThemeService } from '../core/services/theme.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {

  constructor(
    private actionSheetCtrl: ActionSheetController,
    private navCtrl: NavController,
    public themeService: ThemeService
  ) {}

  async openMoreMenu(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Більше можливостей',
      cssClass: 'glass-action-sheet',
      buttons: [
        {
          text: 'Локації',
          icon: 'pin-outline',
          handler: () => {
            this.navCtrl.navigateForward('/tabs/locations');
          }
        },
        {
          text: 'Налаштування',
          icon: 'settings-outline',
          handler: () => {
            this.navCtrl.navigateForward('/tabs/settings');
          }
        },
        {
          text: this.themeService.isDarkMode ? 'Світла тема' : 'Темна тема',
          icon: this.themeService.isDarkMode ? 'sunny-outline' : 'moon-outline',
          handler: () => {
            this.themeService.toggleTheme();
          }
        },
        {
          text: 'Скасувати',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }
}
