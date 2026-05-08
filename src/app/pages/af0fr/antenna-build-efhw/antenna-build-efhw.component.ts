import { Component } from '@angular/core';

type VnaSlide = {
    image: string;
    alt: string;
    title: string;
    description: string;
    borderClass: string;
};

@Component({
    selector: 'antenna-build-efhw',
    standalone: true,
    templateUrl: './antenna-build-efhw.component.html',
})
export class AntennaBuildEFHW {
    activeSlideIndex = 0;

    vnaSlides: VnaSlide[] = [
        {
            image: '/assets/images/efhw/3_21.png',
            alt: 'Previous, poor performing 3 to 21 turn EFHW transformer setup',
            title: 'Previous Setup: 3:21 Turns',
            description:
                'Earlier transformer revision using Type 31 material. The added turns likely pushed the core toward choke-like behavior instead of efficient impedance transformation.',
            borderClass: 'border-slate-500/70',
        },
        {
            image: '/assets/images/efhw/3_21_vna.png',
            alt: 'NanoVNA results from previous 3 to 21 turn EFHW transformer',
            title: 'Previous 3:21 Results',
            description:
                'The sweep showed poor alignment and heavy reactive behavior. This configuration did not produce the clean EFHW response I was looking for.',
            borderClass: 'border-slate-500/70',
        },
        {
            image: '/assets/images/efhw/49_1.png',
            alt: 'Revised 2 to 14 turn 49 to 1 UNUN build',
            title: 'Revised Build: 2:14 Turns',
            description:
                'The current 49:1 UNUN uses a 2 turn primary, 14 turn secondary, and 100 pF capacitor across the primary.',
            borderClass: 'border-white/80',
        },
        {
            image: '/assets/images/efhw/2_14_vna.png',
            alt: 'NanoVNA results from revised 2 to 14 turn EFHW transformer',
            title: 'Revised 2:14 Results',
            description:
                'The sweep showed significant improvement favorable reactive behavior. This configuration shows how resistant the type 31 toroid is to dynamic magnetic flux.',
            borderClass: 'border-slate-500/70',
        },
        {
            image: '/assets/images/efhw/80.png',
            alt: 'NanoVNA sweep of the 80 meter band',
            title: '80m Band',
            description:
                '3–4.5 MHz sweep. Minimum SWR is 1.166 at 3.27 MHz.',
            borderClass: 'border-white/80',
        },
        {
            image: '/assets/images/efhw/40.png',
            alt: 'NanoVNA sweep near the 40 meter region',
            title: '40m Region',
            description:
                '6.5–7.8 MHz sweep. Minimum SWR is 1.171 at 6.552 MHz.',
            borderClass: 'border-white/80',
        },
        {
            image: '/assets/images/efhw/20.png',
            alt: 'NanoVNA sweep near the 20 meter region',
            title: '20m Region',
            description:
                '12.85–14.85 MHz sweep. Minimum SWR is 1.428 at 13.05 MHz.',
            borderClass: 'border-white/80',
        },
        {
            image: '/assets/images/efhw/15.png',
            alt: 'NanoVNA sweep of the 15 meter band',
            title: '15m Band',
            description:
                '20.5–21.95 MHz sweep. Minimum SWR is 3.774 at 21.442 MHz.',
            borderClass: 'border-white/80',
        },
        {
            image: '/assets/images/efhw/10.png',
            alt: 'NanoVNA sweep of the 10 meter band',
            title: '10m Band',
            description:
                '27.7–30.2 MHz sweep. Minimum SWR is 2.032 at 29.471 MHz.',
            borderClass: 'border-white/80',
        },
    ];

    get activeSlide(): VnaSlide {
        return this.vnaSlides[this.activeSlideIndex];
    }

    nextSlide(): void {
        this.activeSlideIndex =
            (this.activeSlideIndex + 1) % this.vnaSlides.length;
    }

    previousSlide(): void {
        this.activeSlideIndex =
            (this.activeSlideIndex - 1 + this.vnaSlides.length) %
            this.vnaSlides.length;
    }

    setSlide(index: number): void {
        this.activeSlideIndex = index;
    }
}