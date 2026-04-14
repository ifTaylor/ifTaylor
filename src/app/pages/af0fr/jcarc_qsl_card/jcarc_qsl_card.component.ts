import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideDownload } from '@lucide/angular';
import * as htmlToImage from 'html-to-image';

interface QslCardForm {
  txCallSign: string;
  rxCallSign: string;
  operator: string;
  gridSquare: string;
  qth: string;
  qslVia: string;
  powerRig: string;
  receiver: string;
  antenna: string;
  dateUtc: string;
  timeUtc: string;
  band: string;
  mhz: string;
  mode: string;
  rstSent: string;
  rstReceived: string;
  remarks: string;
}

@Component({
  selector: 'jcarc-qsl-card',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideDownload],
  templateUrl: './jcarc_qsl_card.component.html',
})
export class JCARCQSLCard {
  isEditorOpen = false;

  form: QslCardForm = {
    txCallSign: '',
    rxCallSign: '',
    operator: '',
    gridSquare: '',
    qth: '',
    qslVia: '',
    powerRig: '',
    receiver: '',
    antenna: '',
    dateUtc: '',
    timeUtc: '',
    band: '',
    mhz: '',
    mode: '',
    rstSent: '',
    rstReceived: '',
    remarks: '',
  };

  openEditor(): void {
    this.isEditorOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeEditor(): void {
    this.isEditorOpen = false;
    document.body.style.overflow = '';
  }

  async downloadCard(): Promise<void> {
    const node = document.getElementById('qsl-card-export');
    if (!node) {
      return;
    }

    try {
      const dataUrl = await htmlToImage.toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#f5f5f3',
      });

      const link = document.createElement('a');
      link.download = 'jcarc-qsl-card.png';
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to download QSL card as PNG:', error);
    }
  }
}