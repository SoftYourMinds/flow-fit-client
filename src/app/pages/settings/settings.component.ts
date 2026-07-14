import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class SettingsComponent implements OnInit {

  constructor(public themeService: ThemeService) { }

  ngOnInit() {}

  toggleTheme() {
    this.themeService.toggleTheme();
  }

}
