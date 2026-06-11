import { AfterViewInit, Component } from '@angular/core';
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

@Component({
    standalone: true,
    selector: 'af0fr-azimuth-map-page',
    templateUrl: './af0fr_azimuth_map.page.html',
})
export class Af0frAzimuthMapPage implements AfterViewInit {
    private map!: L.Map;
    private pendingStart: L.LatLng | null = null;
    lines: AzimuthLine[] = [];

    constructor(private http: HttpClient) {}

    ngAfterViewInit(): void {
        this.map = L.map('azimuth-map').setView([38.4700, -90.3040], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(this.map);

        this.loadLines();

        this.map.on('click', (event: L.LeafletMouseEvent) => {
            this.handleMapClick(event.latlng);
        });
    }

    private handleMapClick(latlng: L.LatLng): void {
        if (!this.pendingStart) {
            this.pendingStart = latlng;

            L.circleMarker(latlng, {
                radius: 6,
            }).addTo(this.map).bindPopup('Start point selected').openPopup();

            return;
        }

        const from = this.pendingStart;
        const to = latlng;

        const bearingDeg = this.calculateBearing(from.lat, from.lng, to.lat, to.lng);
        const distanceMiles = this.calculateDistanceMiles(from.lat, from.lng, to.lat, to.lng);

        const line: AzimuthLine = {
            id: crypto.randomUUID(),
            label: `Azimuth ${Math.round(bearingDeg)}°`,
            fromLat: from.lat,
            fromLng: from.lng,
            toLat: to.lat,
            toLng: to.lng,
            bearingDeg,
            distanceMiles,
            createdBy: 'AF0FR',
        };

        this.http.post<AzimuthLine>(`${environment.apiUrl}/azimuth-lines`, line)
            .subscribe({
                next: (savedLine) => {
                    this.lines.unshift(savedLine);
                    this.drawLine(savedLine);
                },
                error: (error) => {
                    console.error('Failed to save azimuth line', error);
                },
            });

        this.pendingStart = null;
    }

    private loadLines(): void {
        this.http.get<AzimuthLine[]>(`${environment.apiUrl}/azimuth-lines`)
            .subscribe({
                next: (lines) => {
                    this.lines = lines;
                    this.drawAllLines();
                },
                error: (error) => {
                    console.error('Failed to load shared azimuth lines', error);
                },
            });
    }

    private drawAllLines(): void {
        for (const line of this.lines) {
            this.drawLine(line);
        }
    }

    private drawLine(line: AzimuthLine): void {
        const polyline = L.polyline(
            [
                [line.fromLat, line.fromLng],
                [line.toLat, line.toLng],
            ],
            {
                weight: 4,
            }
        ).addTo(this.map);

        polyline.bindPopup(`
      <strong>${line.label}</strong><br>
      Bearing: ${line.bearingDeg.toFixed(1)}°<br>
      Distance: ${line.distanceMiles.toFixed(2)} mi
    `);

        L.circleMarker([line.fromLat, line.fromLng], { radius: 5 })
            .addTo(this.map)
            .bindPopup('Start');

        L.circleMarker([line.toLat, line.toLng], { radius: 5 })
            .addTo(this.map)
            .bindPopup('End');
    }

    refreshLines(): void {
        window.location.reload();
    }

    clearLines(): void {
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