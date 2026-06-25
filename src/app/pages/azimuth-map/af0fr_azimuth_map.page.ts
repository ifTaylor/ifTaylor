import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
    reportId?: string | null;
    reportIds?: string[];
    sourcePointId?: string | null;
    createdAt?: string;
};

type ReportPoint = {
    id: string;
    label: string;
    lat: number;
    lng: number;
    createdBy?: string | null;
    reportId?: string | null;
    reportIds?: string[];
    createdAt?: string;
};

type MapMarker =
    | {
        kind: 'point';
        point: ReportPoint;
    }
    | {
        kind: 'azimuth';
        line: AzimuthLine;
    };

type CallsignGroup = {
    callsign: string;
    color: string;
    markers: MapMarker[];
    points: ReportPoint[];
    lines: AzimuthLine[];
};

type SightingReport = {
    id: string;
    callsign: string;
    reportDate: string;
    reportTime: string;
    sourceLabel: string;
    frequencyMhz: string;
    notes?: string | null;
    createdAt?: string;
};

type RepeaterOption = {
    value: string;
    label: string;
    sourceLabel: string;
    frequencyMhz: string;
};

type AzimuthView = 'reports' | 'map';

@Component({
    standalone: true,
    selector: 'af0fr-azimuth-map-page',
    templateUrl: './af0fr_azimuth_map.page.html',
    imports: [FormsModule]
})
export class Af0frAzimuthMapPage implements AfterViewInit, OnDestroy {
    private refreshIntervalId: number | null = null;
    private savedReportHighlightTimeoutId: number | null = null;
    private map!: L.Map;

    private pendingStart: L.LatLng | null = null;
    private pendingSourcePoint: ReportPoint | null = null;
    private pendingStartMarker: L.Layer | null = null;
    private drawnLayers: L.Layer[] = [];

    headingDeg: number | null = null;
    compassEnabled = false;

    locationEnabled = false;
    currentPosition: L.LatLng | null = null;

    pendingDeleteLineId: string | null = null;
    pendingDeletePointId: string | null = null;
    selectedLineId: string | null = null;
    selectedPointId: string | null = null;

    pendingDeleteReportId: string | null = null;
    highlightedReportId: string | null = null;

    removalModeEnabled = false;

    private locationWatchId: number | null = null;
    private locationMarker: L.Marker | null = null;
    private liveCompassPreviewLayer: L.Layer | null = null;

    private callsignColorMap = new Map<string, string>();

    lines: AzimuthLine[] = [];
    points: ReportPoint[] = [];
    callsignGroups: CallsignGroup[] = [];

    reports: SightingReport[] = [];

    activeAzimuthView: AzimuthView = 'reports';

    reportDate = '';
    reportTime = '';
    reportSourceValue = 'K0EOR_147.030';
    reportReverse = false;
    customFrequencyMhz = '';
    reportNotes = '';
    reportSaveMessage = '';
    isSavingReport = false;

    editingCallsign = false;
    callsignDraft = '';

    readonly repeaterOptions: RepeaterOption[] = [
        {
            value: 'N8WIZ_145.190',
            label: 'N8WIZ — 145.190 MHz',
            sourceLabel: 'N8WIZ',
            frequencyMhz: '145.190',
        },
        {
            value: 'K0QOD_146.625',
            label: 'K0QOD — 146.625 MHz',
            sourceLabel: 'K0QOD',
            frequencyMhz: '146.625',
        },
        {
            value: 'W0KLX_146.700',
            label: 'W0KLX — 146.700 MHz',
            sourceLabel: 'W0KLX',
            frequencyMhz: '146.700',
        },
        {
            value: 'AB0HX_146.715',
            label: 'AB0HX — 146.715 MHz',
            sourceLabel: 'AB0HX',
            frequencyMhz: '146.715',
        },
        {
            value: 'KD0RIS_146.775',
            label: 'KD0RIS — 146.775 MHz',
            sourceLabel: 'KD0RIS',
            frequencyMhz: '146.775',
        },
        {
            value: 'AB0TL_146.835',
            label: 'AB0TL — 146.835 MHz',
            sourceLabel: 'AB0TL',
            frequencyMhz: '146.835',
        },
        {
            value: 'K0EOR_147.030',
            label: 'K0EOR — 147.030 MHz',
            sourceLabel: 'K0EOR',
            frequencyMhz: '147.030',
        },
        {
            value: 'KB0TLL_147.075',
            label: 'KB0TLL — 147.075 MHz',
            sourceLabel: 'KB0TLL',
            frequencyMhz: '147.075',
        },
        {
            value: 'N0WNC_147.195',
            label: 'N0WNC — 147.195 MHz',
            sourceLabel: 'N0WNC',
            frequencyMhz: '147.195',
        },
        {
            value: 'OTHER',
            label: 'Other frequency',
            sourceLabel: 'Other',
            frequencyMhz: '',
        },
    ];

    private readonly colorPalette = [
        '#dc2626',
        '#2563eb',
        '#16a34a',
        '#9333ea',
        '#ea580c',
        '#0891b2',
        '#be123c',
        '#4f46e5',
        '#65a30d',
        '#b45309',
    ];

    constructor(private http: HttpClient) {
        const savedView = localStorage.getItem('azimuth-map-view');
        this.activeAzimuthView = savedView === 'map' ? 'map' : 'reports';
        this.setReportTimeNow();
    }

    get currentCallsign(): string {
        return localStorage.getItem('map-callsign') || 'N0CALL';
    }

    get selectedSourceIsOther(): boolean {
        return this.reportSourceValue === 'OTHER';
    }

    get hasPendingStartPoint(): boolean {
        return this.pendingStart !== null && !this.locationEnabled;
    }

    get canSavePendingStartAsPoint(): boolean {
        return this.pendingStart !== null && !this.locationEnabled && this.pendingSourcePoint === null;
    }

    get mapInstructionText(): string {
        if (this.locationEnabled && !this.currentPosition) {
            return 'Waiting for location...';
        }

        if (this.compassEnabled) {
            if (this.locationEnabled && this.currentPosition) {
                return 'Point your phone toward the signal, then press Save Azimuth.';
            }

            if (this.pendingSourcePoint) {
                return `Point selected. Bearing will start from ${this.pendingSourcePoint.label}. Press Save Azimuth.`;
            }

            if (this.pendingStart) {
                return 'Point your phone toward the signal, then press Save Azimuth.';
            }

            return 'Select a start point on the map, or enable location.';
        }

        if (this.locationEnabled && this.currentPosition) {
            return 'Select an endpoint on the map. Your location will be used as the start point.';
        }

        if (this.pendingSourcePoint) {
            return `Point selected. Tap an endpoint to save an azimuth from ${this.pendingSourcePoint.label}.`;
        }

        if (this.pendingStart) {
            return 'Select an endpoint on the map, or press Set as Point.';
        }

        return 'Select a start point on the map, or enable location.';
    }

    ngAfterViewInit(): void {
        this.map = L.map('azimuth-map', {
            preferCanvas: true,
        }).setView([38.2320, -90.5629], 10);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        }).addTo(this.map);

        this.forceMapResize();

        window.addEventListener('resize', this.handleWindowResize);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        this.loadReports();
        this.loadPoints();
        this.loadLines();

        this.refreshIntervalId = window.setInterval(() => {
            if (!document.hidden) {
                this.loadReports();
                this.loadPoints();
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

        if (this.savedReportHighlightTimeoutId !== null) {
            window.clearTimeout(this.savedReportHighlightTimeoutId);
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

    setAzimuthView(view: AzimuthView): void {
        this.activeAzimuthView = view;
        localStorage.setItem('azimuth-map-view', view);

        if (view === 'map') {
            this.forceMapResize();
            this.refreshCompassPreview();
        }
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
        this.pendingSourcePoint = null;

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

        this.map.setView(this.currentPosition, Math.max(this.map.getZoom(), 5));
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
        let sourcePoint = this.pendingSourcePoint;

        if (this.locationEnabled) {
            if (!this.currentPosition) {
                alert('Waiting for GPS location. Try again in a moment.');
                return;
            }

            start = this.currentPosition;
            sourcePoint = null;

            this.setStartPoint(
                start,
                'Location start selected. Azimuth saved from this point.',
                false
            );
        }

        if (!start) {
            alert('Tap the map first to set a start point, choose a saved point, or enable location.');
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

        const reportIds = sourcePoint ? this.getReportIdsForPoint(sourcePoint) : [];

        this.saveAzimuthLine(start, end, bearingDeg, distanceMiles, {
            reportId: reportIds[0] || null,
            reportIds,
            sourcePointId: sourcePoint?.id || null,
        });

        if (!this.locationEnabled) {
            this.pendingStart = null;
            this.pendingSourcePoint = null;

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

            this.pendingSourcePoint = null;

            this.setStartPoint(
                latlng,
                'Start point selected. Press Save Azimuth to save it, or Set as Point to save a point marker.',
                false
            );

            this.refreshCompassPreview();
            return;
        }

        if (this.locationEnabled) {
            if (!this.currentPosition) {
                alert('Waiting for GPS location. Try again in a moment.');
                return;
            }

            const from = this.currentPosition;
            const to = latlng;

            const bearingDeg = this.calculateBearing(from.lat, from.lng, to.lat, to.lng);
            const distanceMiles = this.calculateDistanceMiles(from.lat, from.lng, to.lat, to.lng);

            this.saveAzimuthLine(from, to, bearingDeg, distanceMiles);
            return;
        }

        if (!this.pendingStart) {
            this.pendingSourcePoint = null;

            this.setStartPoint(
                latlng,
                'Start point selected. Tap an endpoint to save a manual azimuth, or Set as Point to save a point marker.',
                false
            );

            return;
        }

        const from = this.pendingStart;
        const to = latlng;
        const sourcePoint = this.pendingSourcePoint;

        const bearingDeg = this.calculateBearing(from.lat, from.lng, to.lat, to.lng);
        const distanceMiles = this.calculateDistanceMiles(from.lat, from.lng, to.lat, to.lng);
        const reportIds = sourcePoint ? this.getReportIdsForPoint(sourcePoint) : [];

        this.saveAzimuthLine(from, to, bearingDeg, distanceMiles, {
            reportId: reportIds[0] || null,
            reportIds,
            sourcePointId: sourcePoint?.id || null,
        });

        this.pendingStart = null;
        this.pendingSourcePoint = null;

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

    cancelStartPoint(): void {
        this.pendingStart = null;
        this.pendingSourcePoint = null;

        if (this.pendingStartMarker) {
            this.map.removeLayer(this.pendingStartMarker);
            this.pendingStartMarker = null;
        }

        this.clearLiveCompassPreview();
    }

    savePendingStartAsPoint(): void {
        if (!this.pendingStart) {
            alert('Tap the map first to set a start point.');
            return;
        }

        this.saveReportPoint(this.pendingStart);

        this.pendingStart = null;
        this.pendingSourcePoint = null;

        if (this.pendingStartMarker) {
            this.map.removeLayer(this.pendingStartMarker);
            this.pendingStartMarker = null;
        }

        this.clearLiveCompassPreview();
    }

    private saveReportPoint(latlng: L.LatLng, reportId: string | null = null): void {
        const createdBy = this.getOrPromptForCallsign();

        const pointPayload = {
            label: `${createdBy} point`,
            lat: latlng.lat,
            lng: latlng.lng,
            createdBy,
            reportId,
        };

        this.http.post<ReportPoint>(`${environment.apiUrl}/report-points`, pointPayload)
            .subscribe({
                next: (savedPoint) => {
                    this.points.unshift(savedPoint);
                    this.rebuildCallsignGroups();
                    this.drawPoint(savedPoint);
                },
                error: (error) => {
                    console.error('Failed to save report point', error);
                    alert('Failed to save point marker.');
                },
            });
    }

    private saveAzimuthLine(
        from: L.LatLng,
        to: L.LatLng,
        bearingDeg: number,
        distanceMiles: number,
        options: {
            reportId?: string | null;
            reportIds?: string[];
            sourcePointId?: string | null;
        } = {}
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
            reportId: options.reportId || null,
            reportIds: options.reportIds || [],
            sourcePointId: options.sourcePointId || null,
        };

        this.http.post<AzimuthLine>(`${environment.apiUrl}/azimuth-lines`, line)
            .subscribe({
                next: (savedLine) => {
                    this.lines.unshift(savedLine);
                    this.rebuildCallsignGroups();
                    this.drawLine(savedLine);

                    const savedReportIds = this.getReportIdsForLine(savedLine);
                    const extraReportIds = (options.reportIds || [])
                        .filter(reportId => !savedReportIds.includes(reportId));

                    for (const reportId of extraReportIds) {
                        this.addLineReport(savedLine, reportId);
                    }
                },
                error: (error) => {
                    console.error('Failed to save azimuth line', error);
                    alert('Failed to save azimuth line.');
                },
            });
    }

    setLineBearing(line: AzimuthLine, value: string | number): void {
        const parsed = Number(value);

        if (!Number.isFinite(parsed)) {
            alert('Enter a valid bearing.');
            return;
        }

        const normalizedBearing = this.normalizeBearing(parsed);

        this.updateLineBearing(line, normalizedBearing);
    }

    nudgeLineBearing(line: AzimuthLine, deltaDeg: number): void {
        const nextBearing = this.normalizeBearing(line.bearingDeg + deltaDeg);

        this.updateLineBearing(line, nextBearing);
    }

    private updateLineBearing(line: AzimuthLine, bearingDeg: number): void {
        const to = this.destinationPoint(
            line.fromLat,
            line.fromLng,
            bearingDeg,
            line.distanceMiles
        );

        const updatedLine: AzimuthLine = {
            ...line,
            toLat: to.lat,
            toLng: to.lng,
            bearingDeg,
            label: `${this.getLineCallsign(line)} ${Math.round(bearingDeg)}°`,
        };

        this.lines = this.lines.map(existing =>
            existing.id === line.id ? updatedLine : existing
        );

        this.rebuildCallsignGroups();
        this.redrawMapMarkers();

        this.http.patch<AzimuthLine>(
            `${environment.apiUrl}/azimuth-lines/${line.id}`,
            {
                toLat: updatedLine.toLat,
                toLng: updatedLine.toLng,
                bearingDeg: updatedLine.bearingDeg,
                distanceMiles: updatedLine.distanceMiles,
                label: updatedLine.label,
                sourcePointId: updatedLine.sourcePointId || null,
            }
        ).subscribe({
            next: (savedLine) => {
                this.lines = this.lines.map(existing =>
                    existing.id === savedLine.id ? savedLine : existing
                );

                this.rebuildCallsignGroups();
                this.redrawMapMarkers();
            },
            error: (error) => {
                console.error('Failed to update azimuth bearing', error);
                alert('Failed to update azimuth bearing.');
                this.loadLines();
            },
        });
    }

    private normalizeBearing(value: number): number {
        return ((value % 360) + 360) % 360;
    }

    setReportTimeNow(): void {
        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');

        this.reportDate = `${year}-${month}-${day}`;
        this.reportTime = `${hour}:${minute}`;
    }

    setReportSource(value: string): void {
        this.reportSourceValue = value;

        if (!this.selectedSourceIsOther) {
            this.customFrequencyMhz = '';
        } else {
            this.reportReverse = false;
        }
    }

    saveSignalReport(
        reportDate: string,
        reportTime: string,
        sourceValue: string,
        customFrequencyMhz: string,
        notes: string
    ): void {
        if (this.isSavingReport) {
            return;
        }

        this.reportDate = reportDate;
        this.reportTime = reportTime;
        this.reportSourceValue = sourceValue;
        this.customFrequencyMhz = customFrequencyMhz;
        this.reportNotes = notes;

        const selectedOption = this.repeaterOptions.find(option => option.value === sourceValue);

        if (!this.reportDate || !this.reportTime) {
            alert('Enter a report date and time, or press Now.');
            return;
        }

        let sourceLabel = selectedOption?.sourceLabel || 'Other';
        let frequencyMhz = selectedOption?.frequencyMhz || '';

        if (sourceValue === 'OTHER') {
            sourceLabel = 'Other';
            frequencyMhz = this.customFrequencyMhz.trim();

            if (!frequencyMhz) {
                alert('Enter the other frequency.');
                return;
            }
        } else if (this.reportReverse) {
            sourceLabel = `${sourceLabel}-R`;
        }

        const reportPayload = {
            callsign: this.currentCallsign,
            reportDate: this.reportDate,
            reportTime: this.reportTime,
            sourceLabel,
            frequencyMhz,
            notes: this.reportNotes.trim() || null,
        };

        this.isSavingReport = true;

        this.http.post<SightingReport>(`${environment.apiUrl}/sighting-reports`, reportPayload)
            .subscribe({
                next: (savedReport) => {
                    this.reports.unshift(savedReport);
                    this.reportSaveMessage = `Report #${this.getReportDisplayNumber(savedReport)} saved. You can link map markers to it below.`;
                    this.highlightSavedReport(savedReport.id);
                    this.isSavingReport = false;
                },
                error: (error) => {
                    console.error('Failed to save sighting report', error);
                    alert('Failed to save signal report.');
                    this.isSavingReport = false;
                },
            });
    }

    private highlightSavedReport(reportId: string): void {
        this.highlightedReportId = reportId;

        if (this.savedReportHighlightTimeoutId !== null) {
            window.clearTimeout(this.savedReportHighlightTimeoutId);
        }

        this.savedReportHighlightTimeoutId = window.setTimeout(() => {
            if (this.highlightedReportId === reportId) {
                this.highlightedReportId = null;
            }

            this.savedReportHighlightTimeoutId = null;
        }, 5000);
    }

    private loadReports(): void {
        this.http.get<SightingReport[]>(`${environment.apiUrl}/sighting-reports`)
            .subscribe({
                next: (reports) => {
                    this.reports = reports;
                    this.redrawMapMarkers();
                },
                error: (error) => {
                    console.error('Failed to load sighting reports', error);
                },
            });
    }

    private loadPoints(): void {
        this.http.get<ReportPoint[]>(`${environment.apiUrl}/report-points`)
            .subscribe({
                next: (points) => {
                    this.points = points;
                    this.rebuildCallsignGroups();

                    if (this.selectedPointId && !points.some(point => point.id === this.selectedPointId)) {
                        this.selectedPointId = null;
                    }

                    this.redrawMapMarkers();
                },
                error: (error) => {
                    console.error('Failed to load report points', error);
                },
            });
    }

    private loadLines(): void {
        this.http.get<AzimuthLine[]>(`${environment.apiUrl}/azimuth-lines`)
            .subscribe({
                next: (lines) => {
                    this.lines = lines;
                    this.rebuildCallsignGroups();

                    if (this.selectedLineId && !lines.some(line => line.id === this.selectedLineId)) {
                        this.selectedLineId = null;
                    }

                    this.redrawMapMarkers();
                },
                error: (error) => {
                    console.error('Failed to load shared azimuth lines', error);
                },
            });
    }

    getReportDisplayNumber(report: SightingReport): number {
        const chronologicalReports = [...this.reports].sort(
            (left, right) => this.getReportTimestamp(left) - this.getReportTimestamp(right)
        );
        const index = chronologicalReports.findIndex(existing => existing.id === report.id);
        return index >= 0 ? index + 1 : 0;
    }

    private getReportTimestamp(report: SightingReport): number {
        const timestamp = Date.parse(report.createdAt || `${report.reportDate}T${report.reportTime}`);
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    getLineDisplayNumber(line: AzimuthLine): number {
        const index = this.lines.findIndex(existing => existing.id === line.id);
        return index >= 0 ? index + 1 : 0;
    }

    getPointDisplayNumber(point: ReportPoint): number {
        const index = this.points.findIndex(existing => existing.id === point.id);
        return index >= 0 ? index + 1 : 0;
    }

    getMarkerId(marker: MapMarker): string {
        return marker.kind === 'point'
            ? `point-${marker.point.id}`
            : `azimuth-${marker.line.id}`;
    }

    getMarkerCreatedAt(marker: MapMarker): string {
        return marker.kind === 'point'
            ? marker.point.createdAt || ''
            : marker.line.createdAt || '';
    }

    isMarkerSelected(marker: MapMarker): boolean {
        return marker.kind === 'point'
            ? this.selectedPointId === marker.point.id
            : this.selectedLineId === marker.line.id;
    }

    getLinkedLinesForReport(report: SightingReport): AzimuthLine[] {
        return this.lines.filter(line => this.getReportIdsForLine(line).includes(report.id));
    }

    getLinkedPointsForReport(report: SightingReport): ReportPoint[] {
        return this.points.filter(point => this.getReportIdsForPoint(point).includes(report.id));
    }

    getUnlinkedLinesForReport(report: SightingReport): AzimuthLine[] {
        const reportCallsign = this.normalizeCallsign(report.callsign);
        return this.lines.filter(line =>
            this.getLineCallsign(line) === reportCallsign &&
            !this.getReportIdsForLine(line).includes(report.id)
        );
    }

    getUnlinkedPointsForReport(report: SightingReport): ReportPoint[] {
        const reportCallsign = this.normalizeCallsign(report.callsign);
        return this.points.filter(point =>
            this.getPointCallsign(point) === reportCallsign &&
            !this.getReportIdsForPoint(point).includes(report.id)
        );
    }

    getLinkedReportsForPoint(point: ReportPoint): SightingReport[] {
        const reportIds = this.getReportIdsForPoint(point);
        return this.reports.filter(report => reportIds.includes(report.id));
    }

    getUnlinkedReportsForPoint(point: ReportPoint): SightingReport[] {
        const reportIds = this.getReportIdsForPoint(point);
        const pointCallsign = this.getPointCallsign(point);
        return this.reports.filter(report =>
            this.normalizeCallsign(report.callsign) === pointCallsign &&
            !reportIds.includes(report.id)
        );
    }

    getLinkedReportsForLine(line: AzimuthLine): SightingReport[] {
        const reportIds = this.getReportIdsForLine(line);
        return this.reports.filter(report => reportIds.includes(report.id));
    }

    getUnlinkedReportsForLine(line: AzimuthLine): SightingReport[] {
        const reportIds = this.getReportIdsForLine(line);
        const lineCallsign = this.getLineCallsign(line);
        return this.reports.filter(report =>
            this.normalizeCallsign(report.callsign) === lineCallsign &&
            !reportIds.includes(report.id)
        );
    }

    addReportPointLink(report: SightingReport, pointId: string): void {
        const point = this.points.find(existing => existing.id === pointId);

        if (!point) {
            return;
        }

        this.addPointReport(point, report.id);
    }

    addReportLineLink(report: SightingReport, lineId: string): void {
        const line = this.lines.find(existing => existing.id === lineId);

        if (!line) {
            return;
        }

        this.addLineReport(line, report.id);
    }

    addPointReport(point: ReportPoint, reportId: string): void {
        if (!reportId || this.getReportIdsForPoint(point).includes(reportId)) {
            return;
        }

        this.http.post<ReportPoint>(
            `${environment.apiUrl}/report-points/${point.id}/reports/${reportId}`,
            {}
        ).subscribe({
            next: (updatedPoint) => {
                this.points = this.points.map(existing =>
                    existing.id === updatedPoint.id ? updatedPoint : existing
                );

                this.rebuildCallsignGroups();
                this.redrawMapMarkers();
            },
            error: (error) => {
                console.error('Failed to add point report link', error);
                alert('Failed to add report link.');
            },
        });
    }

    removePointReport(point: ReportPoint, reportId: string): void {
        this.http.delete<ReportPoint>(
            `${environment.apiUrl}/report-points/${point.id}/reports/${reportId}`
        ).subscribe({
            next: (updatedPoint) => {
                this.points = this.points.map(existing =>
                    existing.id === updatedPoint.id ? updatedPoint : existing
                );

                this.rebuildCallsignGroups();
                this.redrawMapMarkers();
            },
            error: (error) => {
                console.error('Failed to remove point report link', error);
                alert('Failed to remove report link.');
            },
        });
    }

    addLineReport(line: AzimuthLine, reportId: string): void {
        if (!reportId || this.getReportIdsForLine(line).includes(reportId)) {
            return;
        }

        this.http.post<AzimuthLine>(
            `${environment.apiUrl}/azimuth-lines/${line.id}/reports/${reportId}`,
            {}
        ).subscribe({
            next: (updatedLine) => {
                this.lines = this.lines.map(existing =>
                    existing.id === updatedLine.id ? updatedLine : existing
                );

                this.rebuildCallsignGroups();
                this.redrawMapMarkers();
            },
            error: (error) => {
                console.error('Failed to add azimuth report link', error);
                alert('Failed to add report link.');
            },
        });
    }

    removeLineReport(line: AzimuthLine, reportId: string): void {
        this.http.delete<AzimuthLine>(
            `${environment.apiUrl}/azimuth-lines/${line.id}/reports/${reportId}`
        ).subscribe({
            next: (updatedLine) => {
                this.lines = this.lines.map(existing =>
                    existing.id === updatedLine.id ? updatedLine : existing
                );

                this.rebuildCallsignGroups();
                this.redrawMapMarkers();
            },
            error: (error) => {
                console.error('Failed to remove azimuth report link', error);
                alert('Failed to remove report link.');
            },
        });
    }

    getReportIdsForPoint(point: ReportPoint): string[] {
        if (Array.isArray(point.reportIds)) {
            return point.reportIds;
        }

        return point.reportId ? [point.reportId] : [];
    }

    getReportIdsForLine(line: AzimuthLine): string[] {
        if (Array.isArray(line.reportIds)) {
            return line.reportIds;
        }

        return line.reportId ? [line.reportId] : [];
    }

    getReportSummary(reportId?: string | null): string {
        if (!reportId) {
            return 'No report linked';
        }

        const report = this.reports.find(existing => existing.id === reportId);

        if (!report) {
            return 'Report linked';
        }

        return `Report #${this.getReportDisplayNumber(report)} · ${report.sourceLabel} ${report.frequencyMhz} MHz · ${this.formatReportDateTime(report)}`;
    }

    private getReportListSummary(reportIds: string[]): string {
        if (reportIds.length === 0) {
            return 'No reports linked';
        }

        const summaries = reportIds.map(reportId => {
            const report = this.reports.find(existing => existing.id === reportId);
            return report ? `Report #${this.getReportDisplayNumber(report)}` : 'Report linked';
        });

        return `Linked reports: ${summaries.join(', ')}`;
    }

    getReportChipLabel(report: SightingReport): string {
        return `#${this.getReportDisplayNumber(report)} · ${report.frequencyMhz} MHz · ${this.formatReportDateTime(report)}`;
    }

    getSourcePointSummary(sourcePointId?: string | null): string {
        if (!sourcePointId) {
            return 'No source point linked';
        }

        const point = this.points.find(existing => existing.id === sourcePointId);

        if (!point) {
            return 'Source point linked';
        }

        return `Starts from Point #${this.getPointDisplayNumber(point)}`;
    }

    getLinesForPoint(point: ReportPoint): AzimuthLine[] {
        return this.lines.filter(line => line.sourcePointId === point.id);
    }

    formatReportDateTime(report: SightingReport): string {
        return `${report.reportDate} ${report.reportTime}`;
    }

    private rebuildCallsignGroups(): void {
        const grouped = new Map<string, { points: ReportPoint[]; lines: AzimuthLine[] }>();

        for (const point of this.points) {
            const callsign = this.getPointCallsign(point);
            const existing = grouped.get(callsign) || { points: [], lines: [] };
            existing.points.push(point);
            grouped.set(callsign, existing);
        }

        for (const line of this.lines) {
            const callsign = this.getLineCallsign(line);
            const existing = grouped.get(callsign) || { points: [], lines: [] };
            existing.lines.push(line);
            grouped.set(callsign, existing);
        }

        this.callsignGroups = Array.from(grouped.entries())
            .map(([callsign, items]) => {
                const markers: MapMarker[] = [
                    ...items.points.map(point => ({ kind: 'point' as const, point })),
                    ...items.lines.map(line => ({ kind: 'azimuth' as const, line })),
                ].sort((a, b) => this.getMarkerCreatedAt(b).localeCompare(this.getMarkerCreatedAt(a)));

                return {
                    callsign,
                    color: this.getColorForCallsign(callsign),
                    markers,
                    points: items.points,
                    lines: items.lines,
                };
            })
            .sort((a, b) => a.callsign.localeCompare(b.callsign));
    }

    private drawAllMarkers(): void {
        for (const point of this.points) {
            this.drawPoint(point);
        }

        for (const line of this.lines) {
            this.drawLine(line);
        }
    }

    private drawPoint(point: ReportPoint): void {
        if (!this.map) {
            return;
        }

        const callsign = this.getPointCallsign(point);
        const color = this.getColorForCallsign(callsign);
        const isSelected = this.selectedPointId === point.id;

        const marker = L.circleMarker([point.lat, point.lng], {
            radius: isSelected ? 9 : 7,
            color: isSelected ? '#0f172a' : color,
            fillColor: isSelected ? '#f97316' : color,
            fillOpacity: 1,
            weight: isSelected ? 3 : 2,
        })
            .addTo(this.map)
            .bindPopup(`
                <strong>${callsign}</strong><br>
                Point #${this.getPointDisplayNumber(point)}<br>
                ${point.label}<br>
                ${this.getReportListSummary(this.getReportIdsForPoint(point))}<br>
                ${this.getLinesForPoint(point).length} azimuth(s) from this point
            `);

        marker.on('click', () => {
            this.selectPoint(point);
        });

        this.drawnLayers.push(marker);
    }

    private drawLine(line: AzimuthLine): void {
        if (!this.map) {
            return;
        }

        const callsign = this.getLineCallsign(line);
        const color = this.getColorForCallsign(callsign);
        const isSelected = this.selectedLineId === line.id;

        const polyline = L.polyline(
            [
                [line.fromLat, line.fromLng],
                [line.toLat, line.toLng],
            ],
            {
                color: isSelected ? '#f97316' : color,
                weight: isSelected ? 7 : 4,
                opacity: isSelected ? 1 : 0.75,
            }
        ).addTo(this.map);

        polyline.bindPopup(`
            <strong>${callsign}</strong><br>
            Azimuth #${this.getLineDisplayNumber(line)}<br>
            ${line.label}<br>
            Bearing: ${line.bearingDeg.toFixed(1)}°<br>
            Distance: ${line.distanceMiles.toFixed(2)} mi<br>
            ${this.getReportListSummary(this.getReportIdsForLine(line))}<br>
            ${this.getSourcePointSummary(line.sourcePointId)}
        `);

        polyline.on('click', () => {
            this.selectLine(line);
        });

        this.drawnLayers.push(polyline);

        const startMarker = L.circleMarker([line.fromLat, line.fromLng], {
            radius: isSelected ? 7 : 5,
            color: isSelected ? '#0f172a' : color,
            fillColor: isSelected ? '#f97316' : color,
            fillOpacity: 1,
            weight: isSelected ? 3 : 1,
        })
            .addTo(this.map)
            .bindPopup(`${callsign} start`);

        startMarker.on('click', () => {
            this.selectLine(line);
        });

        this.drawnLayers.push(startMarker);

        const arrowMarker = this.drawArrowHead(line, isSelected ? '#f97316' : color, isSelected);

        arrowMarker.on('click', () => {
            this.selectLine(line);
        });

        this.drawnLayers.push(arrowMarker);
    }

    private drawArrowHead(line: AzimuthLine, color: string, isSelected = false): L.Marker {
        const angle = line.bearingDeg;
        const size = isSelected ? 26 : 18;
        const halfWidth = isSelected ? 11 : 8;
        const height = isSelected ? 24 : 18;
        const anchor = size / 2;

        const arrowIcon = L.divIcon({
            className: '',
            html: `
                <div style="
                    position: relative;
                    width: ${size}px;
                    height: ${size}px;
                ">
                    <div style="
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        width: 0;
                        height: 0;
                        border-left: ${halfWidth}px solid transparent;
                        border-right: ${halfWidth}px solid transparent;
                        border-bottom: ${height}px solid ${color};
                        transform: translate(-50%, -50%) rotate(${angle}deg);
                        transform-origin: center center;
                        filter: ${isSelected ? 'drop-shadow(0 0 4px rgba(0,0,0,0.75))' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))'};
                    "></div>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [anchor, anchor],
        });

        return L.marker([line.toLat, line.toLng], {
            icon: arrowIcon,
            zIndexOffset: isSelected ? 1000 : 0,
        })
            .addTo(this.map)
            .bindPopup(`${this.getLineCallsign(line)} endpoint`);
    }

    private redrawMapMarkers(): void {
        if (!this.map) {
            return;
        }

        for (const layer of this.drawnLayers) {
            this.map.removeLayer(layer);
        }

        this.drawnLayers = [];
        this.drawAllMarkers();
    }

    selectPoint(point: ReportPoint): void {
        if (this.selectedPointId === point.id) {
            this.selectedPointId = null;
        } else {
            this.selectedPointId = point.id;
            this.selectedLineId = null;
        }

        this.pendingDeletePointId = null;
        this.redrawMapMarkers();
    }

    selectLine(line: AzimuthLine): void {
        if (this.selectedLineId === line.id) {
            this.selectedLineId = null;
        } else {
            this.selectedLineId = line.id;
            this.selectedPointId = null;
        }

        this.pendingDeleteLineId = null;
        this.redrawMapMarkers();
    }

    addBearingFromPoint(point: ReportPoint): void {
        this.pendingSourcePoint = point;
        this.setStartPoint(
            L.latLng(point.lat, point.lng),
            `Point #${this.getPointDisplayNumber(point)} selected. Tap an endpoint or enable compass to save a bearing from this point.`,
            true
        );

        this.selectPoint(point);
        this.refreshCompassPreview();
    }

    deletePoint(point: ReportPoint): void {
        if (this.pendingDeletePointId !== point.id) {
            this.pendingDeletePointId = point.id;
            return;
        }

        this.http.delete(`${environment.apiUrl}/report-points/${point.id}`)
            .subscribe({
                next: () => {
                    this.points = this.points.filter(existing => existing.id !== point.id);

                    this.lines = this.lines.map(line =>
                        line.sourcePointId === point.id
                            ? { ...line, sourcePointId: null }
                            : line
                    );

                    if (this.selectedPointId === point.id) {
                        this.selectedPointId = null;
                    }

                    if (this.pendingSourcePoint?.id === point.id) {
                        this.cancelStartPoint();
                    }

                    this.rebuildCallsignGroups();
                    this.redrawMapMarkers();
                    this.pendingDeletePointId = null;
                },
                error: (error) => {
                    console.error('Failed to delete point marker', error);
                    alert('Failed to remove point marker.');
                    this.pendingDeletePointId = null;
                },
            });
    }

    deleteLine(line: AzimuthLine): void {
        if (this.pendingDeleteLineId !== line.id) {
            this.pendingDeleteLineId = line.id;
            return;
        }

        this.http.delete(`${environment.apiUrl}/azimuth-lines/${line.id}`)
            .subscribe({
                next: () => {
                    this.lines = this.lines.filter(existing => existing.id !== line.id);

                    if (this.selectedLineId === line.id) {
                        this.selectedLineId = null;
                    }

                    this.rebuildCallsignGroups();
                    this.redrawMapMarkers();
                    this.pendingDeleteLineId = null;
                },
                error: (error) => {
                    console.error('Failed to delete azimuth line', error);
                    alert('Failed to remove azimuth line.');
                    this.pendingDeleteLineId = null;
                },
            });
    }

    deleteReport(report: SightingReport): void {
        if (this.pendingDeleteReportId !== report.id) {
            this.pendingDeleteReportId = report.id;
            return;
        }

        this.http.delete(`${environment.apiUrl}/sighting-reports/${report.id}`)
            .subscribe({
                next: () => {
                    this.reports = this.reports.filter(existing => existing.id !== report.id);

                    this.points = this.points.map(point => ({
                        ...point,
                        reportId: point.reportId === report.id ? null : point.reportId,
                        reportIds: this.getReportIdsForPoint(point).filter(reportId => reportId !== report.id),
                    }));

                    this.lines = this.lines.map(line => ({
                        ...line,
                        reportId: line.reportId === report.id ? null : line.reportId,
                        reportIds: this.getReportIdsForLine(line).filter(reportId => reportId !== report.id),
                    }));

                    this.rebuildCallsignGroups();
                    this.redrawMapMarkers();

                    this.pendingDeleteReportId = null;
                },
                error: (error) => {
                    console.error('Failed to delete sighting report', error);
                    alert('Failed to remove report.');
                    this.pendingDeleteReportId = null;
                },
            });
    }

    toggleRemovalMode(): void {
        this.removalModeEnabled = !this.removalModeEnabled;

        if (!this.removalModeEnabled) {
            this.pendingDeleteLineId = null;
            this.pendingDeletePointId = null;
            this.pendingDeleteReportId = null;
        }
    }

    private getPointCallsign(point: ReportPoint): string {
        return this.normalizeCallsign(point.createdBy || 'UNKNOWN');
    }

    private getLineCallsign(line: AzimuthLine): string {
        return this.normalizeCallsign(line.createdBy || 'UNKNOWN');
    }

    getColorForCallsign(callsign: string): string {
        const normalized = this.normalizeCallsign(callsign);

        const existingColor = this.callsignColorMap.get(normalized);

        if (existingColor) {
            return existingColor;
        }

        const index = this.callsignColorMap.size % this.colorPalette.length;
        const color = this.colorPalette[index];

        this.callsignColorMap.set(normalized, color);

        return color;
    }

    refreshLines(): void {
        this.loadReports();
        this.loadPoints();
        this.loadLines();
        this.forceMapResize();
    }

    copyShareLink(): void {
        navigator.clipboard.writeText(window.location.href);
    }

    changeCallsign(): void {
        this.callsignDraft = this.currentCallsign;
        this.editingCallsign = true;
    }

    saveCallsign(value: string): void {
        const callsign = this.normalizeCallsign(value || 'N0CALL');

        localStorage.setItem('map-callsign', callsign);

        this.callsignDraft = callsign;
        this.editingCallsign = false;
    }

    cancelCallsignEdit(): void {
        this.callsignDraft = '';
        this.editingCallsign = false;
    }

    private normalizeCallsign(value: string): string {
        return value.trim().toUpperCase().replace(/[^A-Z0-9/]/g, '') || 'UNKNOWN';
    }

    private getOrPromptForCallsign(): string {
        const savedCallsign = localStorage.getItem('map-callsign');

        if (savedCallsign) {
            return savedCallsign;
        }

        const defaultCallsign = 'N0CALL';
        localStorage.setItem('map-callsign', defaultCallsign);

        return defaultCallsign;
    }

    private createLocalId(): string {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
            return crypto.randomUUID();
        }

        return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
