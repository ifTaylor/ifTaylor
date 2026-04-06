import { Component } from '@angular/core';
import * as htmlToImage from 'html-to-image';

@Component({
    standalone: true,
    templateUrl: './af0fr.page.html',
})
export class Af0frPage {
    scrollToAntennaBuild(): void {
        const el = document.getElementById('antenna-build');
        if (!el) return;

        const headerOffset = 88;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
        });
    }

    downloadCard(): void {
        const node = document.getElementById('contact-card-export');
        if (!node) return;

        htmlToImage.toPng(node, {
            pixelRatio: 2,
            backgroundColor: '#f97316',
            cacheBust: true,
            style: {
                padding: '20px',
            }
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