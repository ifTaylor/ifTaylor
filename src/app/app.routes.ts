import { Routes, UrlSegment, UrlMatchResult } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { Af0frPage } from './pages/af0fr/af0fr.page';

export function af0frMatcher(segments: UrlSegment[]): UrlMatchResult | null {
    if (segments.length === 1 && segments[0].path.toLowerCase() === 'af0fr') {
        return { consumed: segments };
    }
    return null;
}

export const routes: Routes = [
    { path: '', component: HomePage },
    { matcher: af0frMatcher, component: Af0frPage },
];