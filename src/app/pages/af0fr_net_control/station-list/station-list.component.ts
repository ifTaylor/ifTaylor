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

    get displayStations(): Station[] {
        return [...this.stations].sort((a, b) => {
            const aPriority = this.stationPriority(a);
            const bPriority = this.stationPriority(b);

            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }

            const aComplete = a.status === 'complete' ? 1 : 0;
            const bComplete = b.status === 'complete' ? 1 : 0;

            if (aComplete !== bComplete) {
                return aComplete - bComplete;
            }

            return 0;
        });
    }

    get totalStations(): number {
        return this.stations.length;
    }

    get regularStations(): number {
        return this.stations.filter((station) => station.trafficType === 'regular').length;
    }

    get shortTimeStations(): number {
        return this.stations.filter((station) => station.trafficType === 'shortTime').length;
    }

    get activeStations(): number {
        return this.stations.filter((station) => station.status === 'active').length;
    }

    get waitingStations(): number {
        return this.stations.filter((station) => station.status === 'waiting').length;
    }

    get memberStations(): number {
        return this.stations.filter((station) => station.member).length;
    }

    get visitorStations(): number {
        return this.stations.filter((station) => station.visitor && !station.firstTime).length;
    }

    get unknownStations(): number {
        return this.stations.filter((station) => station.firstTime).length;
    }

    private stationPriority(station: Station): number {
        if (station.trafficType === 'regular' && station.status !== 'complete') {
            return 0;
        }

        if (station.trafficType === 'regular') {
            return 1;
        }

        return 2;
    }

    trafficClass(traffic: Station['trafficType']): string {
        switch (traffic) {
            case 'shortTime':
                return 'bg-blue-500 text-white';
            default:
                return 'bg-slate-700 text-slate-100';
        }
    }

    trafficLabel(traffic: Station['trafficType']): string {
        return traffic === 'shortTime' ? 'Short time' : 'Regular';
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