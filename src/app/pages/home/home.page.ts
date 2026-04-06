import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    standalone: true,
    imports: [RouterLink],
    templateUrl: './home.page.html',
})
export class HomePage implements OnInit {
    typedText = '';

    private phrases = [
        'Software Engineer',
        'Controls & Automation',
        'Robotics Integration',
        'Amateur Radio Operator',
        'RF Experimenter',
        'Google-Fu Master',
    ];

    private phraseIndex = 0;
    private charIndex = 0;
    private isDeleting = false;

    ngOnInit(): void {
        this.typeLoop();
    }

    scrollToAreasOfFocus(): void {
        const el = document.getElementById('focus');
        if (!el) return;

        const headerOffset = 30;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
        });
    }

    private typeLoop(): void {
        const currentPhrase = this.phrases[this.phraseIndex];

        if (this.isDeleting) {
            this.charIndex--;
        } else {
            this.charIndex++;
        }

        this.typedText = currentPhrase.substring(0, this.charIndex);

        let delay = this.isDeleting ? 45 : 85;

        if (!this.isDeleting && this.charIndex === currentPhrase.length) {
            delay = 1200;
            this.isDeleting = true;
        } else if (this.isDeleting && this.charIndex === 0) {
            this.isDeleting = false;
            this.phraseIndex = (this.phraseIndex + 1) % this.phrases.length;
            delay = 300;
        }

        window.setTimeout(() => this.typeLoop(), delay);
    }
}