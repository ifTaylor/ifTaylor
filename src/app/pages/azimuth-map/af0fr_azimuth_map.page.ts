import { AfterViewInit, Component } from '@angular/core';
import * as L from 'leaflet';

type AzimuthLine = {
    id: string;
    label: string;
    fromLat: number;
    fromLng: number;
    toLat: number;
    toLng: number;
    bearingDeg: number;
    distanceMiles: number;
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

    ngAfterViewInit(): void {
        this.map = L.map('azimuth-map').setView([38.4700, -90.3040], 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(this.map);

        this.loadLines();
        this.drawAllLines();

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
        };

        this.lines.push(line);
        this.saveLines();
        this.drawLine(line);

        this.pendingStart = null;
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

    clearLines(): void {
        localStorage.removeItem('af0fr-azimuth-lines');
        window.location.reload();
    }

    copyShareLink(): void {
        const encoded = btoa(JSON.stringify(this.lines));
        const url = `${window.location.origin}${window.location.pathname}?lines=${encodeURIComponent(encoded)}`;
        navigator.clipboard.writeText(url);
    }

    private loadLines(): void {
        const params = new URLSearchParams(window.location.search);
        const sharedLines = params.get('lines');

        if (sharedLines) {
            try {
                this.lines = JSON.parse(atob(sharedLines));
                localStorage.setItem('af0fr-azimuth-lines', JSON.stringify(this.lines));
                return;
            } catch {
                console.warn('Could not load shared azimuth lines.');
            }
        }

        const saved = localStorage.getItem('af0fr-azimuth-lines');
        this.lines = saved ? JSON.parse(saved) : [];
    }

    private saveLines(): void {
        localStorage.setItem('af0fr-azimuth-lines', JSON.stringify(this.lines));
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