import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as htmlToImage from 'html-to-image';
import { LucidePencil, LucideDownload } from '@lucide/angular';

interface QslCardModel {
    callsign: string;
    operatorName: string;
    location: string;
    grid: string;
    licenseClass: string;
    echolink: string;
    email: string;
    website: string;
    qrzUrl: string;
    focus: string;
    build: string;
    bands: string;
    modes: string;
    gmrs: string;
    notes: string;
    qsoDate: string;
    qsoTimeUtc: string;
    mhz: string;
    band: string;
    mode: string;
    rstSent: string;
    rstRecv: string;
    toRadio: string;
}

@Component({
    selector: 'ham-qsl',
    standalone: true,
    imports: [
        FormsModule,
        LucidePencil,
        LucideDownload
    ],
    templateUrl: './ham_qsl.component.html',
})
export class HamQSL {
    showEditor = false;

    card: QslCardModel = {
        callsign: 'AF0FR',
        operatorName: 'Taylor Turner',
        location: 'St. Louis, Missouri',
        grid: 'EM48UK',
        licenseClass: 'Extra Class',
        echolink: 'EchoLink 524009',
        email: 'af0fr.radio@gmail.com',
        website: 'ifTaylor.com/AF0FR',
        qrzUrl: 'qrz.com/db/AF0FR',
        focus: 'Antenna Design / DIY Radio Interfaces',
        build: '25W Mobile, Folded EFHW',
        bands: '2m / 70cm',
        modes: 'FM / EchoLink',
        gmrs: 'WSLY962',
        notes: 'Licensed March 2026 · Built from curiosity, testing, and a lot of tinkering.',
        qsoDate: this.getCurrentDate(),
        qsoTimeUtc: this.getCurrentUtcTime(),
        mhz: '146.000',
        band: '2m',
        mode: 'FM',
        rstSent: '59',
        rstRecv: '59',
        toRadio: 'KZ0ZZZ',
    };

    getCurrentDate(): string {
        const now = new Date();
        return now.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    getCurrentUtcTime(): string {
        const now = new Date();
        return now.toISOString().slice(11, 16); // HH:MM (UTC)
    }

    openEditor(): void {
        this.showEditor = true;
        document.body.classList.add('overflow-hidden');
    }

    closeEditor(): void {
        this.showEditor = false;
        document.body.classList.remove('overflow-hidden');
    }

    toggleEditor(): void {
        if (this.showEditor) {
            this.closeEditor();
        } else {
            this.openEditor();
        }
    }

    downloadCard(): void {
        const node = document.getElementById('contact-card-export');
        if (!node) return;

        htmlToImage
            .toPng(node, {
                pixelRatio: 2,
                backgroundColor: '#f97316',
                cacheBust: true,
                style: {
                    padding: '20px',
                },
            })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = 'AF0FR-contact.png';
                link.href = dataUrl;
                link.click();
            })
            .catch((err) => {
                console.error('Error generating image:', err);
            });
    }
}