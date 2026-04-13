import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Station } from '../models/station.model';

@Component({
    selector: 'station-list',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './station-list.component.html',
})
export class StationList {
    @Input({ required: true }) stations: Station[] = [];

    @Output() setActive = new EventEmitter<string>();
    @Output() markComplete = new EventEmitter<string>();
    @Output() removeStation = new EventEmitter<string>();

    get displayStations(): Station[] {
        return [...this.stations].sort((a, b) => {
            const aComplete = a.status === 'complete' ? 1 : 0;
            const bComplete = b.status === 'complete' ? 1 : 0;

            if (aComplete !== bComplete) {
                return aComplete - bComplete;
            }

            return 0;
        });
    }

    trafficClass(traffic: Station['trafficType']): string {
        switch (traffic) {
            case 'emergency':
                return 'bg-red-600 text-white';
            case 'priority':
                return 'bg-orange-500 text-white';
            case 'formal':
                return 'bg-amber-500 text-black';
            case 'announcement':
                return 'bg-blue-500 text-white';
            default:
                return 'bg-slate-700 text-slate-100';
        }
    }

    statusClass(status: Station['status']): string {
        switch (status) {
            case 'complete':
                return 'bg-emerald-600 text-white';
            case 'active':
                return 'bg-blue-600 text-white';
            case 'skipped':
                return 'bg-rose-600 text-white';
            default:
                return 'bg-slate-600 text-slate-100';
        }
    }
}