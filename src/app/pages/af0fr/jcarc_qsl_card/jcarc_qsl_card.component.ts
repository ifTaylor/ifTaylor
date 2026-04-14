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
    powerRig: string;
    dateUtc: string;
    timeUtc: string;
    band: string;
    mhz: string;
    mode: string;
    rstSent: string;
    rstReceived: string;
    remarks: string;
}

interface Repeater {
    band: string;
    frequency: string;
    offset: string;
    tone: string;
    details: string;
}

@Component({
    selector: 'jcarc-qsl-card',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideDownload],
    templateUrl: './jcarc_qsl_card.component.html',
})
export class JCARCQSLCard {
    jcarcRepeaters: Repeater[] = [
        {
            band: 'VHF FM / EchoLink',
            frequency: '147.075 MHz',
            offset: '+0.6 MHz',
            tone: '141.3 Hz',
            details: 'KBØTLL · North of Hillsboro · EchoLink',
        },
        {
            band: 'VHF C4FM Wires-X',
            frequency: '147.105 MHz',
            offset: '+0.6 MHz',
            tone: 'None',
            details: 'House Springs 911 Tower · Room 61689',
        },
        {
            band: 'UHF FM',
            frequency: '442.425 MHz',
            offset: '+5 MHz',
            tone: '141.3 Hz',
            details: 'North of Hillsboro · Active 2024',
        },
        {
            band: 'VHF FM (Buck Knob)',
            frequency: '146.775 MHz',
            offset: '+600 kHz',
            tone: '100.0 Hz',
            details: 'Crystal City · KDØRIS · Wires-X local',
        },
        {
            band: '6 Meter FM',
            frequency: '52.950 MHz',
            offset: '-1.7 MHz',
            tone: '192.8 Hz',
            details: 'TX Arnold · RX Barnhart',
        },
    ];

    isEditorOpen = false;

    form: QslCardForm = {
        txCallSign: '',
        rxCallSign: '',
        operator: '',
        gridSquare: '',
        qth: '',
        powerRig: '',
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

    private waitForImages(node: HTMLElement): Promise<void> {
        const images = Array.from(node.querySelectorAll('img'));

        if (images.length === 0) {
            return Promise.resolve();
        }

        return Promise.all(
            images.map((img) => {
                if (img.complete) {
                    return Promise.resolve();
                }

                return new Promise<void>((resolve) => {
                    const done = () => resolve();
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', done, { once: true });
                });
            }),
        ).then(() => undefined);
    }

    async downloadCard(): Promise<void> {
        const node = document.getElementById('qsl-card-export-image');
        if (!node) {
            return;
        }

        try {
            await this.waitForImages(node);
            await new Promise((resolve) => setTimeout(resolve, 100));

            const dataUrl = await htmlToImage.toPng(node, {
                cacheBust: true,
                backgroundColor: '#f8fafc',
                pixelRatio: 1,
                width: 1800,
                height: 1200,
                style: {
                    width: '1800px',
                    height: '1200px',
                },
            });

            const link = document.createElement('a');
            link.download = 'jcarc-qsl-card-6x4.png';
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Failed to download QSL card as PNG:', error);
        }
    }

    get rstCombined(): string {
        if (this.form.rstSent && this.form.rstReceived) {
            return `${this.form.rstSent} / ${this.form.rstReceived}`;
        }

        return this.form.rstSent || this.form.rstReceived || '';
    }
}