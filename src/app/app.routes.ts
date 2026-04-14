import { Routes, UrlSegment, UrlMatchResult } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { Af0frPage } from './pages/af0fr/af0fr.page';
import { Af0frNetControlPage } from './pages/af0fr_net_control/af0fr_net_control.page';
import {CardDemoPage} from "./pages/card_demo/card_demo.page";

export function af0frMatcher(segments: UrlSegment[]): UrlMatchResult | null {
    if (segments.length > 0 && segments[0].path.toLowerCase() === 'af0fr') {
        return { consumed: [segments[0]] };
    }
    return null;
}

export const routes: Routes = [
    { path: '', component: HomePage },
    {
        matcher: af0frMatcher,
        children: [
            { path: '', component: Af0frPage },
            { path: 'net_control', component: Af0frNetControlPage },
            { path: 'card_demo', component: CardDemoPage },
        ],
    },
];