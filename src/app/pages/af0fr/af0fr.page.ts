import { Component } from '@angular/core';

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
}