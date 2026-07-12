import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-note-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './note-modal.component.html',
  styleUrls: ['./note-modal.component.scss']
})
export class NoteModalComponent {
  text: string = '';
  links: string[] = [''];

  constructor(private modalCtrl: ModalController) {}

  addLinkField() {
    this.links.push('');
  }

  removeLinkField(index: number) {
    if (this.links.length > 1) {
      this.links.splice(index, 1);
    } else {
      this.links[0] = '';
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    if (!this.text.trim()) return;
    const validLinks = this.links.map(l => l.trim()).filter(l => l.length > 0);
    return this.modalCtrl.dismiss({
      text: this.text.trim(),
      links: validLinks
    }, 'confirm');
  }
}
