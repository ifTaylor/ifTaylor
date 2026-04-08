import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
    providedIn: 'root'
})
export class LowercaseGuard implements CanActivate {
    constructor(private router: Router) {}

    canActivate(): boolean {
        const currentUrl = this.router.url;
        const lowerUrl = currentUrl.toLowerCase();

        if (currentUrl !== lowerUrl) {
            this.router.navigateByUrl(lowerUrl);
            return false;
        }

        return true;
    }
}