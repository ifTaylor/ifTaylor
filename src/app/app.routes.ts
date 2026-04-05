import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { Af0frPage } from './pages/af0fr/af0fr.page';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'AF0FR', component: Af0frPage },
];
