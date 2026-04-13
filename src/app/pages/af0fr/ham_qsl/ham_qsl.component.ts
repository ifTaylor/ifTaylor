import { Component, OnInit } from '@angular/core';
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
export class HamQSL implements OnInit {
    logoSrc = 'assets/images/logo.png';
    logoDataUrl: string | null = null;

    async ngOnInit(): Promise<void> {
        try {
            const response = await fetch(this.logoSrc);
            const blob = await response.blob();

            this.logoDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Failed to preload logo:', error);
        }
    }

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
        return now.toISOString().slice(0, 10);
    }

    getCurrentUtcTime(): string {
        const now = new Date();
        return now.toISOString().slice(11, 16);
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

    private async waitForImages(container: HTMLElement): Promise<void> {
        const images = Array.from(container.querySelectorAll('img'));

        await Promise.all(
            images.map(async (img) => {
                if (img.complete && img.naturalWidth > 0) {
                    if ('decode' in img) {
                        try {
                            await img.decode();
                        } catch {
                            // ignore decode failure
                        }
                    }
                    return;
                }

                await new Promise<void>((resolve) => {
                    const finish = () => resolve();
                    img.addEventListener('load', finish, { once: true });
                    img.addEventListener('error', finish, { once: true });
                });

                if ('decode' in img) {
                    try {
                        await img.decode();
                    } catch {
                        // ignore decode failure
                    }
                }
            })
        );
    }

    async downloadCard(): Promise<void> {
        const node = document.getElementById('contact-card-export');
        if (!node) return;

        try {
            await this.waitForImages(node);

            await new Promise((resolve) => setTimeout(resolve, 100));

            const dataUrl = await htmlToImage.toPng(node, {
                pixelRatio: 2,
                backgroundColor: '#f97316',
                cacheBust: true,
                style: {
                    padding: '20px',
                },
            });

            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], 'AF0FR-contact.png', { type: 'image/png' });

            if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'AF0FR contact card',
                });
                return;
            }

            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = 'AF0FR-contact.png';
            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        } catch (err) {
            console.error('Error generating image:', err);

            try {
                await this.waitForImages(node);
                await new Promise((resolve) => setTimeout(resolve, 100));

                const dataUrl = await htmlToImage.toPng(node, {
                    pixelRatio: 2,
                    backgroundColor: '#f97316',
                    cacheBust: true,
                    style: {
                        padding: '20px',
                    },
                });

                window.open(dataUrl, '_blank');
            } catch (fallbackErr) {
                console.error('Fallback failed:', fallbackErr);
            }
        }
    }
}