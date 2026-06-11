import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';


import { environment } from '../../../environments/environment';

type AzimuthLine = {
    id: string;
    label: string;
    fromLat: number;
    fromLng: number;
    toLat: number;
    toLng: number;
    bearingDeg: number;
    distanceMiles: number;
    createdBy?: string | null;
    createdAt?: string;
};

type CallsignGroup = {
    callsign: string;
    color: string;
    lines: AzimuthLine[];
};

@Component({
    standalone: true,
    selector: 'af0fr-azimuth-map-page',
    templateUrl: './af0fr_azimuth_map.page.html',
})
export class Af0frAzimuthMapPage implements AfterViewInit, OnDestroy {
    private refreshIntervalId: number | null = null;
    private map!: L.Map;
    private pendingStart: L.LatLng | null = null;
    private pendingStartMarker: L.Layer | null = null;
    private drawnLayers: L.Layer[] = [];

    lines: AzimuthLine[] = [];
    callsignGroups: CallsignGroup[] = [];

    private readonly colorPalette = [
        '#dc2626', // red
        '#2563eb', // blue
        '#16a34a', // green
        '#9333ea', // purple
        '#ea580c', // orange
        '#0891b2', // cyan
        '#be123c', // rose
        '#4f46e5', // indigo
        '#65a30d', // lime
        '#b45309', // amber
    ];

    constructor(private http: HttpClient) {}

    ngAfterViewInit(): void {
        this.map = L.map('azimuth-map').setView([38.4700, -90.3040], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(this.map);

        setTimeout(() => {
            this.map.invalidateSize();
        }, 250);

        this.loadLines();

        this.refreshIntervalId = window.setInterval(() => {
            if (!document.hidden) {
                this.loadLines();
            }
        }, 15000);

        this.map.on('click', (event: L.LeafletMouseEvent) => {
            this.handleMapClick(event.latlng);
        });
    }

    ngOnDestroy(): void {
        if (this.refreshIntervalId !== null) {
            window.clearInterval(this.refreshIntervalId);
        }
    }

    private handleMapClick(latlng: L.LatLng): void {
        if (!this.pendingStart) {
            this.pendingStart = latlng;

            if (this.pendingStartMarker) {
                this.map.removeLayer(this.pendingStartMarker);
            }

            this.pendingStartMarker = L.circleMarker(latlng, {
                radius: 6,
                color: '#111827',
                fillColor: '#f97316',
                fillOpacity: 1,
            })
                .addTo(this.map)
                .bindPopup('Start point selected')
                .openPopup();

            return;
        }

        const from = this.pendingStart;
        const to = latlng;

        const bearingDeg = this.calculateBearing(from.lat, from.lng, to.lat, to.lng);
        const distanceMiles = this.calculateDistanceMiles(from.lat, from.lng, to.lat, to.lng);

        const createdBy = this.getOrPromptForCallsign();

        const line: AzimuthLine = {
            id: this.createLocalId(),
            label: `${createdBy} ${Math.round(bearingDeg)}°`,
            fromLat: from.lat,
            fromLng: from.lng,
            toLat: to.lat,
            toLng: to.lng,
            bearingDeg,
            distanceMiles,
            createdBy,
        };

        this.http.post<AzimuthLine>(`${environment.apiUrl}/azimuth-lines`, line)
            .subscribe({
                next: (savedLine) => {
                    this.lines.unshift(savedLine);
                    this.rebuildCallsignGroups();
                    this.drawLine(savedLine);
                },
                error: (error) => {
                    console.error('Failed to save azimuth line', error);
                },
            });

        this.pendingStart = null;

        if (this.pendingStartMarker) {
            this.map.removeLayer(this.pendingStartMarker);
            this.pendingStartMarker = null;
        }
    }

    private createLocalId(): string {
        if (crypto && 'randomUUID' in crypto) {
            return crypto.randomUUID();
        }

        return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    private getOrPromptForCallsign(): string {
        const savedCallsign = localStorage.getItem('af0fr-map-callsign');

        if (savedCallsign) {
            return savedCallsign;
        }

        const entered = window.prompt('Enter your call sign for this azimuth:', 'AF0FR');
        const callsign = this.normalizeCallsign(entered || 'UNKNOWN');

        localStorage.setItem('af0fr-map-callsign', callsign);

        return callsign;
    }

    changeCallsign(): void {
        const current = localStorage.getItem('af0fr-map-callsign') || '';
        const entered = window.prompt('Enter your call sign:', current);
        const callsign = this.normalizeCallsign(entered || 'UNKNOWN');

        localStorage.setItem('af0fr-map-callsign', callsign);
    }

    private normalizeCallsign(value: string): string {
        return value.trim().toUpperCase().replace(/[^A-Z0-9/]/g, '') || 'UNKNOWN';
    }

    private loadLines(): void {
        this.http.get<AzimuthLine[]>(`${environment.apiUrl}/azimuth-lines`)
            .subscribe({
                next: (lines) => {
                    this.lines = lines;
                    this.rebuildCallsignGroups();
                    this.redrawMapLines();
                },
                error: (error) => {
                    console.error('Failed to load shared azimuth lines', error);
                },
            });
    }

    private rebuildCallsignGroups(): void {
        const grouped = new Map<string, AzimuthLine[]>();

        for (const line of this.lines) {
            const callsign = this.getLineCallsign(line);
            const existing = grouped.get(callsign) || [];
            existing.push(line);
            grouped.set(callsign, existing);
        }

        this.callsignGroups = Array.from(grouped.entries())
            .map(([callsign, lines]) => ({
                callsign,
                color: this.getColorForCallsign(callsign),
                lines,
            }))
            .sort((a, b) => a.callsign.localeCompare(b.callsign));
    }

    private drawAllLines(): void {
        for (const line of this.lines) {
            this.drawLine(line);
        }
    }

    private drawLine(line: AzimuthLine): void {
        const callsign = this.getLineCallsign(line);
        const color = this.getColorForCallsign(callsign);

        const polyline = L.polyline(
            [
                [line.fromLat, line.fromLng],
                [line.toLat, line.toLng],
            ],
            {
                color,
                weight: 4,
            }
        ).addTo(this.map);

        polyline.bindPopup(`
            <strong>${callsign}</strong><br>
            ${line.label}<br>
            Bearing: ${line.bearingDeg.toFixed(1)}°<br>
            Distance: ${line.distanceMiles.toFixed(2)} mi
        `);

        this.drawnLayers.push(polyline);

        const startMarker = L.circleMarker([line.fromLat, line.fromLng], {
            radius: 5,
            color,
            fillColor: color,
            fillOpacity: 1,
        })
            .addTo(this.map)
            .bindPopup(`${callsign} start`);

        this.drawnLayers.push(startMarker);

        const arrowMarker = this.drawArrowHead(line, color);
        this.drawnLayers.push(arrowMarker);
    }

    private drawArrowHead(line: AzimuthLine, color: string): L.Marker {
        const angle = line.bearingDeg;

        const arrowIcon = L.divIcon({
            className: '',
            html: `
                <div style="
                    width: 0;
                    height: 0;
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-bottom: 18px solid ${color};
                    transform: rotate(${angle}deg);
                    transform-origin: center center;
                    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
                "></div>
            `,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
        });

        return L.marker([line.toLat, line.toLng], {
            icon: arrowIcon,
        })
            .addTo(this.map)
            .bindPopup(`${this.getLineCallsign(line)} endpoint`);
    }

    private redrawMapLines(): void {
        for (const layer of this.drawnLayers) {
            this.map.removeLayer(layer);
        }

        this.drawnLayers = [];
        this.drawAllLines();
    }

    deleteLine(line: AzimuthLine): void {
        const confirmed = window.confirm(
            `Remove ${line.label} from the shared azimuth map?`
        );

        if (!confirmed) {
            return;
        }

        this.http.delete(`${environment.apiUrl}/azimuth-lines/${line.id}`)
            .subscribe({
                next: () => {
                    this.lines = this.lines.filter(existing => existing.id !== line.id);
                    this.rebuildCallsignGroups();
                    this.redrawMapLines();
                },
                error: (error) => {
                    console.error('Failed to delete azimuth line', error);
                },
            });
    }

    private getLineCallsign(line: AzimuthLine): string {
        return this.normalizeCallsign(line.createdBy || 'UNKNOWN');
    }

    getColorForCallsign(callsign: string): string {
        const normalized = this.normalizeCallsign(callsign);
        let hash = 0;

        for (let i = 0; i < normalized.length; i++) {
            hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
        }

        const index = Math.abs(hash) % this.colorPalette.length;

        return this.colorPalette[index];
    }

    refreshLines(): void {
        window.location.reload();
    }

    copyShareLink(): void {
        navigator.clipboard.writeText(window.location.href);
    }

    private calculateBearing(
        fromLat: number,
        fromLng: number,
        toLat: number,
        toLng: number
    ): number {
        const lat1 = this.toRad(fromLat);
        const lat2 = this.toRad(toLat);
        const deltaLng = this.toRad(toLng - fromLng);

        const y = Math.sin(deltaLng) * Math.cos(lat2);
        const x =
            Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

        const bearing = this.toDeg(Math.atan2(y, x));

        return (bearing + 360) % 360;
    }

    private calculateDistanceMiles(
        fromLat: number,
        fromLng: number,
        toLat: number,
        toLng: number
    ): number {
        const earthRadiusMiles = 3958.8;

        const dLat = this.toRad(toLat - fromLat);
        const dLng = this.toRad(toLng - fromLng);

        const lat1 = this.toRad(fromLat);
        const lat2 = this.toRad(toLat);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return earthRadiusMiles * c;
    }

    private toRad(deg: number): number {
        return deg * Math.PI / 180;
    }

    private toDeg(rad: number): number {
        return rad * 180 / Math.PI;
    }
}