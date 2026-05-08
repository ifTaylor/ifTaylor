import { Component } from '@angular/core';

@Component({
    selector: 'ham-intro',
    standalone: true,
    templateUrl: './ham_intro.component.html',
})
export class HamIntro {
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

    scrollToEchoLinkBuild(): void {
        const el = document.getElementById('echolink-build');
        if (!el) return;

        const headerOffset = 88;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
        });
    }

    scrollToKeyerBuild(): void {
        const el = document.getElementById('keyer');
        if (!el) return;

        const headerOffset = 88;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
        });
    }

    scrollToEFHWBuild(): void {
        const el = document.getElementById('antenna-build-efhw');
        if (!el) return;

        const headerOffset = 88;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
        });
    }

    openQrz() {
        window.open('https://www.qrz.com/db/AF0FR', '_blank');
    }
}