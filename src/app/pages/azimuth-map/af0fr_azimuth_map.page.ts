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

    headingDeg: number | null = null;
    compassEnabled = false;

    locationEnabled = false;
    currentPosition: L.LatLng | null = null;

    private locationWatchId: number | null = null;
    private locationMarker: L.Marker | null = null;
    private liveCompassPreviewLayer: L.Layer | null = null;

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
        this.map = L.map('azimuth-map', {
            preferCanvas: true,
        }).setView([38.4700, -90.3040], 10);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        }).addTo(this.map);

        this.forceMapResize();

        window.addEventListener('resize', this.handleWindowResize);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

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

        this.disableCompass();
        this.disableLocation();

        window.removeEventListener('resize', this.handleWindowResize);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    private handleWindowResize = (): void => {
        this.forceMapResize();
        this.refreshCompassPreview();
    };

    private handleVisibilityChange = (): void => {
        if (!document.hidden) {
            this.forceMapResize();
            this.refreshCompassPreview();
        }
    };

    private forceMapResize(): void {
        const resize = () => {
            if (this.map) {
                this.map.invalidateSize(false);
            }
        };

        requestAnimationFrame(resize);
        window.setTimeout(resize, 100);
        window.setTimeout(resize, 300);
        window.setTimeout(resize, 750);
    }

    toggleLocation(): void {
        if (this.locationEnabled) {
            this.disableLocation();
            return;
        }

        this.enableLocation();
    }

    private enableLocation(): void {
        if (!navigator.geolocation) {
            alert('Geolocation is not available on this device.');
            return;
        }

        this.locationEnabled = true;

        this.locationWatchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = L.latLng(
                    position.coords.latitude,
                    position.coords.longitude
                );

                this.updateLocationMarker();

                if (this.compassEnabled) {
                    this.setStartPoint(
                        this.currentPosition,
                        'Location start selected. The orange dotted line follows your phone heading. Press Save Azimuth to save it.',
                        false
                    );

                    this.refreshCompassPreview();
                }
            },
            (error) => {
                console.error('Failed to get location', error);
                alert(this.getLocationErrorMessage(error));
                this.disableLocation();
            },
            {
                enableHighAccuracy: true,
                maximumAge: 1000,
                timeout: 30000,
            }
        );
    }

    private disableLocation(): void {
        if (this.locationWatchId !== null) {
            navigator.geolocation.clearWatch(this.locationWatchId);
            this.locationWatchId = null;
        }

        this.locationEnabled = false;
        this.currentPosition = null;

        if (this.locationMarker) {
            this.map.removeLayer(this.locationMarker);
            this.locationMarker = null;
        }

        this.clearLiveCompassPreview();
    }

    private getLocationErrorMessage(error: GeolocationPositionError): string {
        switch (error.code) {
            case error.PERMISSION_DENIED:
                return 'Location permission was denied. Check Safari location permissions for this site.';
            case error.POSITION_UNAVAILABLE:
                return 'Location is unavailable. Try going outside or turning Wi-Fi/cellular location services on.';
            case error.TIMEOUT:
                return 'Location timed out. Try again, or move somewhere with better GPS reception.';
            default:
                return 'Could not get your location.';
        }
    }

    private updateLocationMarker(): void {
        if (!this.currentPosition) {
            return;
        }

        const icon = L.divIcon({
            className: '',
            html: `
                <div style="
                    width: 18px;
                    height: 18px;
                    border-radius: 9999px;
                    background: #0f172a;
                    border: 3px solid #f97316;
                    box-shadow: 0 0 0 4px rgba(249,115,22,0.25);
                "></div>
            `,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
        });

        if (this.locationMarker) {
            this.locationMarker.setLatLng(this.currentPosition);
            this.locationMarker.setIcon(icon);
            return;
        }

        this.locationMarker = L.marker(this.currentPosition, {
            icon,
        })
            .addTo(this.map)
            .bindPopup('Your location. With location enabled, Save Azimuth uses this as the start point.');

        this.map.setView(this.currentPosition, Math.max(this.map.getZoom(), 14));
    }

    toggleCompass(): void {
        if (this.compassEnabled) {
            this.disableCompass();
            return;
        }

        void this.enableCompass();
    }

    private async enableCompass(): Promise<void> {
        if (this.compassEnabled) {
            return;
        }

        if (typeof DeviceOrientationEvent === 'undefined') {
            alert('Compass heading is not available on this device.');
            return;
        }

        const deviceOrientationEvent = DeviceOrientationEvent as unknown as {
            requestPermission?: () => Promise<'granted' | 'denied'>;
        };

        if (deviceOrientationEvent.requestPermission) {
            const permission = await deviceOrientationEvent.requestPermission();

            if (permission !== 'granted') {
                alert('Compass permission was not granted.');
                return;
            }
        }

        window.addEventListener('deviceorientation', this.handleDeviceOrientation, true);
        this.compassEnabled = true;

        if (this.locationEnabled && this.currentPosition) {
            this.setStartPoint(
                this.currentPosition,
                'Location start selected. The orange dotted line follows your phone heading. Press Save Azimuth to save it.',
                false
            );
        }

        this.refreshCompassPreview();
    }

    private disableCompass(): void {
        if (this.compassEnabled) {
            window.removeEventListener('deviceorientation', this.handleDeviceOrientation, true);
        }

        this.compassEnabled = false;
        this.headingDeg = null;
        this.clearLiveCompassPreview();
    }

    private handleDeviceOrientation = (event: DeviceOrientationEvent): void => {
        const safariHeading = (event as DeviceOrientationEvent & {
            webkitCompassHeading?: number;
        }).webkitCompassHeading;

        let heading: number | null = null;

        if (typeof safariHeading === 'number') {
            heading = safariHeading;
        } else if (event.alpha !== null) {
            heading = 360 - event.alpha;
        }

        if (heading === null) {
            return;
        }

        this.headingDeg = (heading + 360) % 360;

        if (this.locationEnabled && this.currentPosition) {
            this.pendingStart = this.currentPosition;
        }

        this.refreshCompassPreview();
    };

    lockCurrentAzimuth(): void {
        if (!this.compassEnabled) {
            alert('Enable compass first.');
            return;
        }

        if (this.headingDeg === null) {
            alert('Point the phone toward the signal and wait for a compass heading.');
            return;
        }

        let start = this.pendingStart;

        if (this.locationEnabled) {
            if (!this.currentPosition) {
                alert('Waiting for GPS location. Try again in a moment.');
                return;
            }

            start = this.currentPosition;

            this.setStartPoint(
                start,
                'Location start selected. Azimuth saved from this point.',
                false
            );
        }

        if (!start) {
            alert('Tap the map first to set a start point, or enable location.');
            return;
        }

        const bearingDeg = this.headingDeg;
        const end = this.getMapEdgePointForBearing(start, bearingDeg);
        const distanceMiles = this.calculateDistanceMiles(
            start.lat,
            start.lng,
            end.lat,
            end.lng
        );

        this.saveAzimuthLine(start, end, bearingDeg, distanceMiles);

        if (!this.locationEnabled) {
            this.pendingStart = null;

            if (this.pendingStartMarker) {
                this.map.removeLayer(this.pendingStartMarker);
                this.pendingStartMarker = null;
            }
        }

        this.clearLiveCompassPreview();

        if (this.locationEnabled && this.currentPosition) {
            this.setStartPoint(
                this.currentPosition,
                'Location start selected. The orange dotted line follows your phone heading. Press Save Azimuth to save it.',
                false
            );

            this.refreshCompassPreview();
        }
    }

    private refreshCompassPreview(): void {
        if (!this.compassEnabled || this.headingDeg === null) {
            this.clearLiveCompassPreview();
            return;
        }

        const start = this.getCompassStartPoint();

        if (!start) {
            this.clearLiveCompassPreview();
            return;
        }

        if (this.locationEnabled && this.currentPosition) {
            this.pendingStart = this.currentPosition;
        }

        this.drawLiveCompassPreviewToMapEdge(start);
    }

    private getCompassStartPoint(): L.LatLng | null {
        if (this.locationEnabled && this.currentPosition) {
            return this.currentPosition;
        }

        return this.pendingStart;
    }

    private drawLiveCompassPreviewToMapEdge(start: L.LatLng): void {
        if (this.headingDeg === null) {
            return;
        }

        if (this.liveCompassPreviewLayer) {
            this.map.removeLayer(this.liveCompassPreviewLayer);
        }

        const previewEnd = this.getMapEdgePointForBearing(
            start,
            this.headingDeg
        );

        this.liveCompassPreviewLayer = L.polyline(
            [
                [start.lat, start.lng],
                [previewEnd.lat, previewEnd.lng],
            ],
            {
                color: '#f97316',
                weight: 3,
                dashArray: '6, 8',
            }
        )
            .addTo(this.map)
            .bindPopup(`Live compass preview: ${this.headingDeg.toFixed(0)}°. Press Save Azimuth to save this line.`);
    }

    private clearLiveCompassPreview(): void {
        if (this.liveCompassPreviewLayer) {
            this.map.removeLayer(this.liveCompassPreviewLayer);
            this.liveCompassPreviewLayer = null;
        }
    }

    private getMapEdgePointForBearing(start: L.LatLng, bearingDeg: number): L.LatLng {
        const bounds = this.map.getBounds();

        let distanceMiles = 0.25;
        let point = this.destinationPoint(
            start.lat,
            start.lng,
            bearingDeg,
            distanceMiles
        );

        while (bounds.contains(point) && distanceMiles < 500) {
            distanceMiles *= 1.25;

            point = this.destinationPoint(
                start.lat,
                start.lng,
                bearingDeg,
                distanceMiles
            );
        }

        return point;
    }

    private handleMapClick(latlng: L.LatLng): void {
        if (this.compassEnabled) {
            if (this.locationEnabled) {
                alert('Location is enabled, so Save Azimuth uses your GPS position as the start point. Disable Location to pick a start point manually.');
                return;
            }

            this.setStartPoint(
                latlng,
                'Start point selected. Press Save Azimuth to save it.'
            );

            this.refreshCompassPreview();
            return;
        }

        if (!this.pendingStart) {
            this.setStartPoint(
                latlng,
                'Start point selected. Tap an endpoint to save a manual azimuth.'
            );

            return;
        }

        const from = this.pendingStart;
        const to = latlng;

        const bearingDeg = this.calculateBearing(from.lat, from.lng, to.lat, to.lng);
        const distanceMiles = this.calculateDistanceMiles(from.lat, from.lng, to.lat, to.lng);

        this.saveAzimuthLine(from, to, bearingDeg, distanceMiles);

        this.pendingStart = null;

        if (this.pendingStartMarker) {
            this.map.removeLayer(this.pendingStartMarker);
            this.pendingStartMarker = null;
        }

        this.clearLiveCompassPreview();
    }

    private setStartPoint(latlng: L.LatLng, popupText: string, openPopup = true): void {
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
            .bindPopup(popupText);

        if (openPopup) {
            this.pendingStartMarker.openPopup();
        }
    }

    private saveAzimuthLine(
        from: L.LatLng,
        to: L.LatLng,
        bearingDeg: number,
        distanceMiles: number
    ): void {
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
    }

    private destinationPoint(
        fromLat: number,
        fromLng: number,
        bearingDeg: number,
        distanceMiles: number
    ): L.LatLng {
        const earthRadiusMiles = 3958.8;

        const angularDistance = distanceMiles / earthRadiusMiles;
        const bearing = this.toRad(bearingDeg);

        const lat1 = this.toRad(fromLat);
        const lng1 = this.toRad(fromLng);

        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(angularDistance) +
            Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
        );

        const lng2 =
            lng1 +
            Math.atan2(
                Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
                Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
            );

        return L.latLng(this.toDeg(lat2), this.toDeg(lng2));
    }

    private createLocalId(): string {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
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
        this.loadLines();
        this.forceMapResize();
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