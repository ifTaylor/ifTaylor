import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { Af0frPage } from './pages/af0fr/af0fr.page';
import { LowercaseGuard } from './lowercase.guard';

export const routes: Routes = [
    { path: '', component: HomePage },
    {
        path: 'af0fr',
        component: Af0frPage,
        canActivate: [LowercaseGuard]
    },
];
