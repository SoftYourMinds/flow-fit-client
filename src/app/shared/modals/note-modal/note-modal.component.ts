import { Component, Input, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { QuillModule } from 'ngx-quill';
import { StorageService } from '../../../core/services/storage.service';

@Component({
  selector: 'app-note-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, QuillModule],
  templateUrl: './note-modal.component.html',
  styleUrls: ['./note-modal.component.scss']
})
export class NoteModalComponent implements OnInit {
  @Input() note?: any;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  text: string = '';
  links: string[] = []; // Now stores attachments directly

  isUploading = false;
  
  // Minimal quill config for just bold, italic, underline, list
  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'bullet' }]
    ]
  };

  constructor(
    private modalCtrl: ModalController,
    private storageService: StorageService
  ) {}

  ngOnInit() {
    if (this.note) {
      this.text = this.note.text || '';
      if (this.note.links && this.note.links.length > 0) {
        this.links = [...this.note.links].filter(l => l.trim() !== '');
      }
    }
  }

  triggerFileUpload() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.isUploading = true;
      this.storageService.uploadFile(file).subscribe({
        next: (res) => {
          this.links.push(res.url);
          this.isUploading = false;
        },
        error: (err) => {
          console.error('Failed to upload file', err);
          this.isUploading = false;
        }
      });
    }
    // reset input
    event.target.value = null;
  }

  removeLink(index: number) {
    this.links.splice(index, 1);
  }

  trackByIndex(index: number): number {
    return index;
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    if (!this.text || !this.text.trim()) return;
    return this.modalCtrl.dismiss({
      text: this.text.trim(),
      links: this.links
    }, 'confirm');
  }
}

