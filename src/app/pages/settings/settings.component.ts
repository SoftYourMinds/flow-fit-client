import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, NavController } from '@ionic/angular';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class SettingsComponent implements OnInit {

  notificationsEnabled = true;

  constructor(
    public themeService: ThemeService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private navCtrl: NavController
  ) { }

  ngOnInit() {
    // Read from local storage if we want persistence across app restarts
    const saved = localStorage.getItem('notificationsEnabled');
    if (saved !== null) {
      this.notificationsEnabled = saved === 'true';
    }
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  async onNotificationsToggle(event: any) {
    const isChecked = event.detail.checked;
    
    if (!isChecked) {
      const alert = await this.alertCtrl.create({
        header: 'Вимкнути сповіщення?',
        message: 'Ви дійсно бажаєте вимкнути сповіщення? Усі заплановані нагадування будуть скасовані.',
        buttons: [
          {
            text: 'Скасувати',
            role: 'cancel',
            handler: () => {
              // Revert toggle
              this.notificationsEnabled = true;
            }
          },
          {
            text: 'Вимкнути',
            role: 'destructive',
            handler: async () => {
              await this.notificationService.cancelAll();
              localStorage.setItem('notificationsEnabled', 'false');
            }
          }
        ]
      });
      await alert.present();
    } else {
      localStorage.setItem('notificationsEnabled', 'true');
      // To properly sync, we'd need sessions, but we'll sync on next app launch or schedule navigation
    }
  }

  logout() {
    this.notificationService.cancelAll();
    this.authService.logout();
    this.navCtrl.navigateRoot('/login');
  }

}
