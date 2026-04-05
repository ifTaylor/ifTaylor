import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.page.html',
})
export class HomePage {
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
}
