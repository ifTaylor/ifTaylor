import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Station } from '../models/station.model';

type StationMembershipFilter = 'member' | 'visitor' | 'unknown';

@Component({
    selector: 'station-list',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './station-list.component.html',
})
export class StationList {
    @Input({ required: true }) stations: Station[] = [];
    @Input() editing = false;

    @Output() setActive = new EventEmitter<string>();
    @Output() markComplete = new EventEmitter<string>();
    @Output() stationChange = new EventEmitter<Station>();

    activeMembershipFilters = new Set<StationMembershipFilter>();

    get displayStations(): Station[] {
        return this.filteredStations.sort((a, b) => {
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

    get filteredStations(): Station[] {
        if (!this.activeMembershipFilters.size) {
            return [...this.stations];
        }

        return this.stations.filter((station) =>
            (this.activeMembershipFilters.has('member') && station.member) ||
            (this.activeMembershipFilters.has('visitor') && station.visitor && !station.firstTime) ||
            (this.activeMembershipFilters.has('unknown') && station.firstTime)
        );
    }

    get filteredStationsCount(): number {
        return this.filteredStations.length;
    }

    get hasMembershipFilter(): boolean {
        return this.activeMembershipFilters.size > 0;
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

    trackByStationId(_index: number, station: Station): string {
        return station.id;
    }

    toggleMembershipFilter(filter: StationMembershipFilter): void {
        if (this.activeMembershipFilters.has(filter)) {
            this.activeMembershipFilters.delete(filter);
        } else {
            this.activeMembershipFilters.add(filter);
        }
    }

    clearMembershipFilters(): void {
        this.activeMembershipFilters.clear();
    }

    membershipFilterActive(filter: StationMembershipFilter): boolean {
        return this.activeMembershipFilters.has(filter);
    }

    updateTrafficType(station: Station, trafficType: Station['trafficType']): void {
        if (station.trafficType === trafficType) return;
        this.stationChange.emit({ ...station, trafficType });
    }

    updateNotes(station: Station, notes: string): void {
        const cleanNotes = notes.trim();
        if ((station.notes ?? '') === cleanNotes) return;
        this.stationChange.emit({ ...station, notes: cleanNotes });
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
