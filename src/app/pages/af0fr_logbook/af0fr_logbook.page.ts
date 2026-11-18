import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

type LogbookView = 'qsoEntry' | 'sessionLog' | 'spots' | 'dxSummit';
type ContestMode = 'GENERAL' | 'SST';

interface LogbookEntry {
    id: string;
    contest: ContestMode;
    callsign: string;
    qsoDate: string;
    timeOn: string;
    band: string;
    frequency: string;
    mode: string;
    rstSent: string;
    rstReceived: string;
    name: string;
    qth: string;
    state: string;
    country: string;
    parkReference: string;
    notes: string;
}

interface SstMultiplierMark {
    key: string;
    label: string;
    column: 'S/P' | 'DXc';
}

interface SstEntryRow {
    entry: LogbookEntry;
    multipliers: SstMultiplierMark[];
    spMultiplier: SstMultiplierMark | null;
    dxcMultiplier: SstMultiplierMark | null;
}

interface NamedLogbook {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    entries: LogbookEntry[];
}

interface ZipPlaceResponse {
    places: Array<{ latitude: string; longitude: string }>;
}

interface PotaSpot {
    activator?: string;
    reference?: string;
    frequency?: number | string;
    mode?: string;
    comments?: string;
    comment?: string;
    spotterComments?: string;
    locationDesc?: string;
    name?: string;
}

interface PotaPark {
    reference?: string;
    name?: string;
    latitude?: number | string;
    longitude?: number | string;
    locationDesc?: string;
}

interface PotaSpotRow {
    miles: number;
    activator: string;
    reference: string;
    park: string;
    location: string;
    frequency: string;
    band: string;
    mode: string;
    comments: string;
}

interface PotaSkipCounts {
    inactive: number;
    program: number;
    mode: number;
    band: number;
    noCoordinates: number;
    duplicates: number;
}

interface DxSpotRow {
    time: string;
    spotter: string;
    frequency: string;
    callsign: string;
    comment: string;
    band: string;
    mode: string;
    country: string;
}

interface DxSummitApiSpot {
    de_call?: string;
    dx_call?: string;
    frequency?: number | string;
    time?: string;
    info?: string | null;
    dx_country?: string | null;
}

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './af0fr_logbook.page.html',
})
export class Af0frLogbookPage implements OnInit {
    private readonly legacyStorageKey = 'af0fr-logbook-entries';
    private readonly logsStorageKey = 'af0fr-logbook-logs';
    private readonly activeLogKey = 'af0fr-logbook-active-log';
    private readonly profileKey = 'af0fr-logbook-profile';
    private readonly contestModeKey = 'af0fr-logbook-mode';
    private readonly potaSpotsUrl = 'https://api.pota.app/spot/activator';
    private readonly zipUrl = 'https://api.zippopotam.us/us/';
    private readonly potaParksUrl = 'https://api.pota.app/program/parks/';

    readonly bands = ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '2m', '70cm'];
    readonly modes = ['SSB', 'CW', 'FM', 'FT8', 'FT4', 'AM', 'RTTY', 'JS8'];
    activeView: LogbookView = 'qsoEntry';
    operatorCall = 'AF0FR';
    operatorName = '';
    stationGrid = 'EM48';
    stationCity = '';
    stationState = 'MO';
    stationCountry = 'USA';
    stationRig = '';
    stationAntenna = '';
    stationPower = '';
    logbooks: NamedLogbook[] = [];
    activeLogId = '';
    newLogName = '';
    editingId = '';
    currentContest: ContestMode = 'GENERAL';
    form: LogbookEntry = this.blankEntry();

    potaZip = '63129';
    potaMode = 'ANY';
    potaBand = 'ANY';
    potaPrograms = 'US';
    potaLimit = 30;
    potaLoading = false;
    potaError = '';
    potaRows: PotaSpotRow[] = [];
    potaSkipped: PotaSkipCounts = this.blankSkipCounts();

    dxSummitUrl = 'http://www.dxsummit.fi/api/v1/spots';
    dxSummitLimit = 50;
    dxSummitRaw = '';
    dxSummitLoading = false;
    dxSummitError = '';
    dxSummitRows: DxSpotRow[] = [];

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.restoreProfile();
        this.restoreContestMode();
        this.restoreLogbooks();
    }

    get activeLogbook(): NamedLogbook {
        const found = this.logbooks.find((logbook) => logbook.id === this.activeLogId);

        if (found) {
            return found;
        }

        const fallback = this.createLogbook('General', []);
        this.logbooks = [fallback];
        this.activeLogId = fallback.id;
        this.persistLogbooks();
        return fallback;
    }

    get entries(): LogbookEntry[] {
        return this.activeLogbook.entries;
    }

    get sortedEntries(): LogbookEntry[] {
        return [...this.entries].sort((a, b) => `${b.qsoDate}${b.timeOn}`.localeCompare(`${a.qsoDate}${a.timeOn}`));
    }

    get qsoCount(): number {
        return this.entries.length;
    }

    get sstRows(): SstEntryRow[] {
        return this.buildSstRows(this.sortedEntries.slice().reverse()).reverse();
    }

    get sstQsoCount(): number {
        return this.entries.filter((entry) => entry.contest === 'SST').length;
    }

    get sstMultiplierCount(): number {
        const multipliers = new Set<string>();

        for (const row of this.buildSstRows(this.entries)) {
            for (const multiplier of row.multipliers) {
                multipliers.add(multiplier.key);
            }
        }

        return multipliers.size;
    }

    get sstSpMultiplierCount(): number {
        return this.sstMultiplierColumnCount('S/P');
    }

    get sstDxcMultiplierCount(): number {
        return this.sstMultiplierColumnCount('DXc');
    }

    get sstScore(): number {
        return this.sstQsoCount * this.sstMultiplierCount;
    }

    get exportDisabled(): boolean {
        return this.entries.length === 0;
    }

    selectView(view: LogbookView): void {
        this.activeView = view;
    }

    selectLogbook(logbookId: string): void {
        if (this.activeLogId === logbookId) return;

        this.activeLogId = logbookId;
        localStorage.setItem(this.activeLogKey, logbookId);
        this.clearForm();
    }

    addLogbook(): void {
        const name = this.newLogName.trim() || `Log ${this.logbooks.length + 1}`;
        const logbook = this.createLogbook(name, []);

        this.logbooks = [...this.logbooks, logbook];
        this.newLogName = '';
        this.selectLogbook(logbook.id);
        this.activeView = 'qsoEntry';
        this.persistLogbooks();
    }

    renameActiveLogbook(): void {
        const current = this.activeLogbook;
        const name = window.prompt('Logbook name', current.name)?.trim();

        if (!name) return;

        this.logbooks = this.logbooks.map((logbook) =>
            logbook.id === current.id
                ? { ...logbook, name, updatedAt: new Date().toISOString() }
                : logbook
        );
        this.persistLogbooks();
    }

    deleteActiveLogbook(): void {
        if (this.logbooks.length <= 1) {
            window.alert('Keep at least one logbook.');
            return;
        }

        const current = this.activeLogbook;
        if (!window.confirm(`Delete "${current.name}" and its ${current.entries.length} QSOs?`)) return;

        this.logbooks = this.logbooks.filter((logbook) => logbook.id !== current.id);
        this.selectLogbook(this.logbooks[0].id);
        this.persistLogbooks();
    }

    saveProfile(): void {
        this.operatorCall = this.normalizeCallsign(this.operatorCall);
        this.operatorName = this.operatorName.trim();
        this.stationGrid = this.stationGrid.trim().toUpperCase();
        this.stationCity = this.stationCity.trim();
        this.stationState = this.stationState.trim().toUpperCase();
        this.stationCountry = this.stationCountry.trim();
        this.stationRig = this.stationRig.trim();
        this.stationAntenna = this.stationAntenna.trim();
        this.stationPower = this.stationPower.trim();
        localStorage.setItem(this.profileKey, JSON.stringify({
            operatorCall: this.operatorCall,
            operatorName: this.operatorName,
            stationGrid: this.stationGrid,
            stationCity: this.stationCity,
            stationState: this.stationState,
            stationCountry: this.stationCountry,
            stationRig: this.stationRig,
            stationAntenna: this.stationAntenna,
            stationPower: this.stationPower,
        }));
    }

    saveEntry(): void {
        const normalized = this.normalizeEntry(this.form);

        if (!normalized.callsign || !normalized.qsoDate || !normalized.timeOn) {
            window.alert('Callsign, date, and time are required.');
            return;
        }

        if (normalized.contest === 'SST') {
            const exchangeError = this.sstExchangeError(normalized);
            if (exchangeError) {
                window.alert(exchangeError);
                return;
            }

            const dupe = this.findSstDupe(normalized, this.editingId);
            if (dupe && !window.confirm(`${normalized.callsign} is already logged for SST on ${normalized.band}. Save anyway?`)) {
                return;
            }
        }

        const updatedEntries = this.editingId
            ? this.entries.map((entry) => entry.id === this.editingId ? { ...normalized, id: this.editingId } : entry)
            : [{ ...normalized, id: crypto.randomUUID() }, ...this.entries];

        this.updateActiveEntries(updatedEntries);
        this.clearForm();
    }

    editEntry(entry: LogbookEntry): void {
        this.editingId = entry.id;
        this.form = { ...entry };
        this.activeView = 'qsoEntry';
    }

    deleteEntry(entryId: string): void {
        const target = this.entries.find((entry) => entry.id === entryId);
        if (!window.confirm(`Delete QSO with ${target?.callsign ?? 'this station'}?`)) return;

        this.updateActiveEntries(this.entries.filter((entry) => entry.id !== entryId));

        if (this.editingId === entryId) {
            this.clearForm();
        }
    }

    clearForm(): void {
        this.editingId = '';
        this.form = this.blankEntry();
    }

    setSstLog(enabled: boolean): void {
        const contest: ContestMode = enabled ? 'SST' : 'GENERAL';
        const defaults = this.blankEntry(contest);

        this.currentContest = contest;
        localStorage.setItem(this.contestModeKey, contest);
        this.form = this.normalizeEntry({
            ...this.form,
            contest,
            mode: defaults.mode,
            rstSent: defaults.rstSent,
            rstReceived: defaults.rstReceived,
        }, contest);
    }

    exportAdif(): void {
        if (!this.entries.length) return;

        const header = [
            'AF0FR Logbook export',
            '<ADIF_VER:5>3.1.4',
            '<PROGRAMID:14>AF0FR Logbook',
            '<PROGRAMVERSION:3>1.0',
            '<EOH>',
            '',
        ].join('\r\n');
        const body = this.sortedEntries.map((entry) => this.entryToAdif(entry)).join('\r\n');
        const blob = new Blob([`${header}${body}\r\n`], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logName = this.activeLogbook.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'logbook';

        anchor.href = url;
        anchor.download = `af0fr-${logName}-${timestamp}.adi`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    exportSstCabrillo(): void {
        const entries = this.sortedEntries.filter((entry) => entry.contest === 'SST');
        if (!entries.length) return;

        const lines = [
            'START-OF-LOG: 3.0',
            'CREATED-BY: AF0FR Logbook',
            'CONTEST: K1USNSST',
            `CALLSIGN: ${this.operatorCall || 'NOCALL'}`,
            `LOCATION: ${this.stationState || 'DX'}`,
            `OPERATORS: ${this.operatorCall || 'NOCALL'}`,
            'CATEGORY-OPERATOR: SINGLE-OP',
            'CATEGORY-MODE: CW',
            'CATEGORY-POWER: LOW',
            'CLAIMED-SCORE: ' + this.sstScore,
            ...entries.slice().reverse().map((entry) => this.entryToSstCabrilloQso(entry)),
            'END-OF-LOG:',
        ];
        const blob = new Blob([`${lines.join('\r\n')}\r\n`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logName = this.activeLogbook.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sst';

        anchor.href = url;
        anchor.download = `af0fr-${logName}-k1usnsst-${timestamp}.log`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    async loadPotaSpots(): Promise<void> {
        this.potaLoading = true;
        this.potaError = '';
        this.potaRows = [];
        this.potaSkipped = this.blankSkipCounts();

        try {
            const zip = await firstValueFrom(this.http.get<ZipPlaceResponse>(`${this.zipUrl}${encodeURIComponent(this.potaZip.trim())}`));
            const place = zip.places[0];

            if (!place) {
                throw new Error('ZIP lookup did not return a location.');
            }

            const homeLat = Number(place.latitude);
            const homeLon = Number(place.longitude);
            const spots = await firstValueFrom(this.http.get<PotaSpot[]>(this.potaSpotsUrl));
            const programs = this.parseProgramFilter(this.potaPrograms);
            const modeFilter = this.potaMode === 'ANY' ? '' : this.potaMode;
            const bandFilter = this.potaBand === 'ANY' ? '' : this.potaBand;
            const parkCaches = new Map<string, Map<string, PotaPark>>();
            const seen = new Set<string>();
            const rows: PotaSpotRow[] = [];
            const skipped = this.blankSkipCounts();

            for (const spot of spots) {
                if (this.isProbablyInactive(spot)) {
                    skipped.inactive += 1;
                    continue;
                }

                if (modeFilter && this.safeString(spot.mode).toUpperCase() !== modeFilter) {
                    skipped.mode += 1;
                    continue;
                }

                const band = this.bandFromFrequencyKhz(spot.frequency);
                if (bandFilter && band.toUpperCase() !== bandFilter.toUpperCase()) {
                    skipped.band += 1;
                    continue;
                }

                const reference = this.safeString(spot.reference).trim();
                const prefix = this.programPrefixFromReference(reference);

                if (!reference || !prefix) {
                    skipped.noCoordinates += 1;
                    continue;
                }

                if (programs.size && !programs.has(prefix)) {
                    skipped.program += 1;
                    continue;
                }

                const activator = this.normalizeCallsign(this.safeString(spot.activator));
                const frequency = this.normalizeFrequency(spot.frequency);
                const mode = this.safeString(spot.mode, 'N/A').trim().toUpperCase();
                const dedupeKey = `${activator}|${reference}|${frequency}|${mode}`;

                if (seen.has(dedupeKey)) {
                    skipped.duplicates += 1;
                    continue;
                }
                seen.add(dedupeKey);

                if (!parkCaches.has(prefix)) {
                    parkCaches.set(prefix, await this.loadParkCache(prefix));
                }

                const park = parkCaches.get(prefix)?.get(reference);
                const lat = Number(park?.latitude);
                const lon = Number(park?.longitude);

                if (!park || Number.isNaN(lat) || Number.isNaN(lon)) {
                    skipped.noCoordinates += 1;
                    continue;
                }

                rows.push({
                    miles: this.haversineMiles(homeLat, homeLon, lat, lon),
                    activator,
                    reference,
                    park: park.name || this.safeString(spot.name),
                    location: this.safeString(spot.locationDesc || park.locationDesc),
                    frequency,
                    band,
                    mode,
                    comments: this.spotComment(spot),
                });
            }

            this.potaRows = rows.sort((a, b) => a.miles - b.miles).slice(0, Math.max(1, this.potaLimit));
            this.potaSkipped = skipped;
        } catch (error) {
            console.error(error);
            this.potaError = 'Could not load live POTA spots from this browser. The API may be unavailable or blocked by CORS.';
        } finally {
            this.potaLoading = false;
        }
    }

    usePotaSpot(row: PotaSpotRow): void {
        this.form = this.normalizeEntry({
            ...this.form,
            callsign: row.activator,
            frequency: this.frequencyKhzToMhz(row.frequency),
            band: row.band || this.form.band,
            mode: row.mode,
            parkReference: row.reference,
            qth: row.location,
            notes: [row.park, row.comments].filter(Boolean).join(' | '),
        });
        this.activeView = 'qsoEntry';
    }

    async loadDxSummit(): Promise<void> {
        this.dxSummitLoading = true;
        this.dxSummitError = '';

        try {
            const response = await this.fetchDxSummitSpots();
            this.dxSummitRows = response.map((spot) => this.mapDxSummitSpot(spot)).filter((row): row is DxSpotRow => !!row);
            this.dxSummitRaw = JSON.stringify(response, null, 2);
        } catch (error) {
            console.error(error);
            this.dxSummitError = 'Could not fetch DX Summit from this browser. Paste copied spot text or DX Summit JSON below and parse it here.';
        } finally {
            this.dxSummitLoading = false;
        }
    }

    parseDxSummit(): void {
        const raw = this.dxSummitRaw.trim();

        if (!raw) {
            this.dxSummitRows = [];
            return;
        }

        try {
            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {
                this.dxSummitRows = parsed
                    .map((spot) => this.mapDxSummitSpot(spot as DxSummitApiSpot))
                    .filter((row): row is DxSpotRow => !!row)
                    .slice(0, 100);
                return;
            }
        } catch {
            // Fall through to line parsing for copied table text.
        }

        this.dxSummitRows = raw
            .split(/\r?\n/)
            .map((line) => this.parseDxLine(line))
            .filter((row): row is DxSpotRow => !!row)
            .slice(0, 100);
    }

    useDxSpot(row: DxSpotRow): void {
        this.form = this.normalizeEntry({
            ...this.form,
            callsign: row.callsign,
            frequency: row.frequency,
            band: row.band || this.form.band,
            mode: row.mode || this.form.mode,
            country: row.country || this.form.country,
            notes: row.comment,
        });
        this.activeView = 'qsoEntry';
    }

    private async fetchDxSummitSpots(): Promise<DxSummitApiSpot[]> {
        const limit = Math.max(1, Math.min(Number(this.dxSummitLimit) || 50, 200));
        const backendUrl = `${environment.apiUrl}/dx-summit/spots?limit=${encodeURIComponent(String(limit))}`;

        try {
            return await firstValueFrom(this.http.get<DxSummitApiSpot[]>(backendUrl));
        } catch (backendError) {
            console.warn('DX Summit backend proxy failed, trying direct API', backendError);
            const directUrl = `${this.dxSummitUrl}?limit=${encodeURIComponent(String(limit))}&limit_time=true&refresh=${Date.now()}`;
            return firstValueFrom(this.http.get<DxSummitApiSpot[]>(directUrl));
        }
    }

    private restoreProfile(): void {
        const raw = localStorage.getItem(this.profileKey);
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw) as Partial<{
                operatorCall: string;
                operatorName: string;
                stationGrid: string;
                stationCity: string;
                stationState: string;
                stationCountry: string;
                stationRig: string;
                stationAntenna: string;
                stationPower: string;
            }>;
            this.operatorCall = this.normalizeCallsign(parsed.operatorCall ?? this.operatorCall);
            this.operatorName = (parsed.operatorName ?? this.operatorName).trim();
            this.stationGrid = (parsed.stationGrid ?? this.stationGrid).trim().toUpperCase();
            this.stationCity = (parsed.stationCity ?? this.stationCity).trim();
            this.stationState = (parsed.stationState ?? this.stationState).trim().toUpperCase();
            this.stationCountry = (parsed.stationCountry ?? this.stationCountry).trim();
            this.stationRig = (parsed.stationRig ?? this.stationRig).trim();
            this.stationAntenna = (parsed.stationAntenna ?? this.stationAntenna).trim();
            this.stationPower = (parsed.stationPower ?? this.stationPower).trim();
        } catch (error) {
            console.error('Failed to restore logbook profile', error);
        }
    }

    private restoreContestMode(): void {
        this.currentContest = localStorage.getItem(this.contestModeKey) === 'SST' ? 'SST' : 'GENERAL';
        this.form = this.blankEntry();
    }

    private restoreLogbooks(): void {
        const raw = localStorage.getItem(this.logsStorageKey);

        try {
            const parsed = raw ? JSON.parse(raw) : null;
            this.logbooks = Array.isArray(parsed)
                ? parsed.map((logbook) => this.normalizeLogbook(logbook)).filter((logbook): logbook is NamedLogbook => !!logbook)
                : [];
        } catch (error) {
            console.error('Failed to restore named logbooks', error);
            this.logbooks = [];
        }

        if (!this.logbooks.length) {
            this.logbooks = [this.createLogbook('General', this.restoreLegacyEntries())];
        }

        const savedActiveLogId = localStorage.getItem(this.activeLogKey);
        this.activeLogId = this.logbooks.some((logbook) => logbook.id === savedActiveLogId)
            ? savedActiveLogId ?? this.logbooks[0].id
            : this.logbooks[0].id;

        this.persistLogbooks();
    }

    private restoreLegacyEntries(): LogbookEntry[] {
        const raw = localStorage.getItem(this.legacyStorageKey);
        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
                ? parsed.map((entry) => this.normalizeEntry(entry as Partial<LogbookEntry>)).filter((entry) => entry.callsign)
                : [];
        } catch (error) {
            console.error('Failed to restore legacy logbook entries', error);
            return [];
        }
    }

    private persistLogbooks(): void {
        localStorage.setItem(this.logsStorageKey, JSON.stringify(this.logbooks));
        localStorage.setItem(this.activeLogKey, this.activeLogId);
    }

    private updateActiveEntries(entries: LogbookEntry[]): void {
        const now = new Date().toISOString();

        this.logbooks = this.logbooks.map((logbook) =>
            logbook.id === this.activeLogbook.id
                ? { ...logbook, entries, updatedAt: now }
                : logbook
        );
        this.persistLogbooks();
    }

    private createLogbook(name: string, entries: LogbookEntry[]): NamedLogbook {
        const now = new Date().toISOString();

        return {
            id: crypto.randomUUID(),
            name,
            createdAt: now,
            updatedAt: now,
            entries,
        };
    }

    private normalizeLogbook(value: unknown): NamedLogbook | null {
        if (!value || typeof value !== 'object') return null;

        const logbook = value as Partial<NamedLogbook>;
        const entries = Array.isArray(logbook.entries)
            ? logbook.entries.map((entry) => this.normalizeEntry(entry)).filter((entry) => entry.callsign)
            : [];
        const now = new Date().toISOString();

        return {
            id: logbook.id || crypto.randomUUID(),
            name: logbook.name?.trim() || 'General',
            createdAt: logbook.createdAt || now,
            updatedAt: logbook.updatedAt || now,
            entries,
        };
    }

    private blankEntry(contest: ContestMode = this.currentContest): LogbookEntry {
        const now = new Date();
        const sst = contest === 'SST';

        return {
            id: '',
            contest,
            callsign: '',
            qsoDate: now.toISOString().slice(0, 10),
            timeOn: now.toISOString().slice(11, 16),
            band: '20m',
            frequency: '',
            mode: sst ? 'CW' : 'SSB',
            rstSent: sst ? '599' : '59',
            rstReceived: sst ? '599' : '59',
            name: '',
            qth: '',
            state: '',
            country: 'USA',
            parkReference: '',
            notes: '',
        };
    }

    private normalizeEntry(entry: Partial<LogbookEntry>, defaultContest: ContestMode = 'GENERAL'): LogbookEntry {
        const contest = entry.contest === 'SST' ? 'SST' : defaultContest;
        const blank = this.blankEntry(contest);

        return {
            id: entry.id ?? '',
            contest,
            callsign: this.normalizeCallsign(entry.callsign ?? ''),
            qsoDate: entry.qsoDate ?? blank.qsoDate,
            timeOn: (entry.timeOn ?? blank.timeOn).slice(0, 5),
            band: entry.band ?? blank.band,
            frequency: (entry.frequency ?? '').trim(),
            mode: (entry.mode ?? (contest === 'SST' ? 'CW' : blank.mode)).trim().toUpperCase(),
            rstSent: (entry.rstSent ?? (contest === 'SST' ? '599' : blank.rstSent)).trim(),
            rstReceived: (entry.rstReceived ?? (contest === 'SST' ? '599' : blank.rstReceived)).trim(),
            name: (entry.name ?? '').trim(),
            qth: (entry.qth ?? '').trim(),
            state: (entry.state ?? '').trim().toUpperCase(),
            country: (entry.country ?? blank.country).trim(),
            parkReference: (entry.parkReference ?? '').trim().toUpperCase(),
            notes: (entry.notes ?? '').trim(),
        };
    }

    private entryToAdif(entry: LogbookEntry): string {
        const fields: Array<[string, string]> = [
            ['CALL', entry.callsign],
            ['QSO_DATE', entry.qsoDate.replace(/-/g, '')],
            ['TIME_ON', entry.timeOn.replace(':', '')],
            ['BAND', entry.band],
            ['FREQ', entry.frequency],
            ['MODE', entry.mode],
            ['RST_SENT', entry.rstSent],
            ['RST_RCVD', entry.rstReceived],
            ['NAME', entry.name],
            ['QTH', entry.qth],
            ['STATE', entry.state],
            ['COUNTRY', entry.country],
            ['OPERATOR', this.operatorName],
            ['MY_CALL', this.operatorCall],
            ['MY_GRIDSQUARE', this.stationGrid],
            ['MY_CITY', this.stationCity],
            ['MY_STATE', this.stationState],
            ['MY_COUNTRY', this.stationCountry],
            ['MY_RIG', this.stationRig],
            ['MY_ANTENNA', this.stationAntenna],
            ['TX_PWR', this.stationPower],
            ['CONTEST_ID', entry.contest === 'SST' ? 'K1USN-SST' : ''],
            ['SRX_STRING', entry.contest === 'SST' ? this.sstReceivedExchange(entry) : ''],
            ['STX_STRING', entry.contest === 'SST' ? this.sstSentExchange() : ''],
            ['SIG', entry.parkReference ? 'POTA' : ''],
            ['SIG_INFO', entry.parkReference],
            ['COMMENT', entry.notes],
        ];

        return `${fields.map(([name, value]) => this.adifField(name, value)).join('')}<EOR>`;
    }

    private adifField(name: string, value: string): string {
        const cleanValue = value.trim();
        return cleanValue ? `<${name}:${cleanValue.length}>${cleanValue}` : '';
    }

    private normalizeCallsign(value: string): string {
        return value.trim().toUpperCase().replace(/Ø/g, '0');
    }

    private buildSstRows(entries: LogbookEntry[]): SstEntryRow[] {
        const seenMultipliers = new Set<string>();
        const rows: SstEntryRow[] = [];

        for (const entry of entries) {
            if (entry.contest !== 'SST') {
                rows.push({ entry, multipliers: [], spMultiplier: null, dxcMultiplier: null });
                continue;
            }

            const multiplier = this.sstMultiplierForEntry(entry);
            const multipliers = multiplier && !seenMultipliers.has(multiplier.key) ? [multiplier] : [];

            if (multiplier) {
                seenMultipliers.add(multiplier.key);
            }

            rows.push({
                entry,
                multipliers,
                spMultiplier: multipliers.find((mark) => mark.column === 'S/P') ?? null,
                dxcMultiplier: multipliers.find((mark) => mark.column === 'DXc') ?? null,
            });
        }

        return rows;
    }

    private sstMultiplierColumnCount(column: SstMultiplierMark['column']): number {
        const multipliers = new Set<string>();

        for (const row of this.buildSstRows(this.entries)) {
            for (const multiplier of row.multipliers) {
                if (multiplier.column === column) {
                    multipliers.add(multiplier.key);
                }
            }
        }

        return multipliers.size;
    }

    private sstExchangeError(entry: LogbookEntry): string {
        if (!entry.name) {
            return 'SST entries require the received name.';
        }

        if (!this.sstMultiplierForEntry(entry)) {
            return 'SST entries require a valid State/Province or DX country.';
        }

        return '';
    }

    private findSstDupe(entry: LogbookEntry, editingId = ''): LogbookEntry | undefined {
        return this.entries.find((candidate) =>
            candidate.id !== editingId &&
            candidate.contest === 'SST' &&
            candidate.callsign === entry.callsign &&
            candidate.band === entry.band
        );
    }

    sstMultiplierForEntry(entry: LogbookEntry): SstMultiplierMark | null {
        const spc = this.normalizeSstSpc(entry.state || entry.qth);

        if (spc) {
            return {
                key: `${entry.band}|SPC|${spc}`,
                label: spc,
                column: 'S/P',
            };
        }

        const country = this.sstCountryPrefix(entry);
        if (!country) return null;

        return {
            key: `${entry.band}|COUNTRY|${country}`,
            label: country,
            column: 'DXc',
        };
    }

    sstReceivedExchange(entry: LogbookEntry): string {
        return [entry.name, entry.state || entry.country].filter(Boolean).join(' ');
    }

    sstSentExchange(): string {
        return [this.operatorName, this.stationState || this.stationCountry].filter(Boolean).join(' ');
    }

    private normalizeSstSpc(value: string): string {
        const candidate = value.trim().toUpperCase();
        const statesAndProvinces = new Set([
            'AL', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'ID', 'IL', 'IN', 'IA', 'KS',
            'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
            'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
            'WI', 'WY', 'DC', 'AB', 'BC', 'LB', 'MB', 'NB', 'NF', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
        ]);

        return statesAndProvinces.has(candidate) ? candidate : '';
    }

    private sstCountryPrefix(entry: LogbookEntry): string {
        const country = entry.country.trim().toUpperCase();
        const call = entry.callsign.replace(/\/.*/, '');

        if (/^KL7/.test(call)) return 'KL';
        if (/^KH6/.test(call)) return 'KH6';
        if (/^KP[234]/.test(call)) return 'KP';
        if (/^(K|N|W|A[A-L]|VA|VE|VO|VY)/.test(call)) return '';
        return country && !['USA', 'UNITED STATES', 'US', 'CANADA', 'CA'].includes(country) ? country : '';
    }

    private entryToSstCabrilloQso(entry: LogbookEntry): string {
        const sentExchange = this.sstSentExchange() || [this.operatorName || this.operatorCall, this.stationState || 'DX'].join(' ');
        const frequency = this.cabrilloFrequency(entry);

        return [
            'QSO:',
            this.padCabrillo(frequency, 5),
            this.padCabrillo(entry.mode || 'CW', 2),
            entry.qsoDate,
            entry.timeOn.replace(':', ''),
            this.padCabrillo(this.operatorCall || 'NOCALL', 13),
            this.padCabrillo(sentExchange, 15),
            this.padCabrillo(entry.callsign, 13),
            this.padCabrillo(entry.name, 10),
            this.padCabrillo(this.sstExchangeValue(entry), 5),
        ].join(' ').trimEnd();
    }

    private sstExchangeValue(entry: LogbookEntry): string {
        return this.normalizeSstSpc(entry.state || entry.qth) || this.sstCountryPrefix(entry) || entry.country.trim().toUpperCase();
    }

    private cabrilloFrequency(entry: LogbookEntry): string {
        const mhz = Number(entry.frequency);
        if (!Number.isNaN(mhz) && mhz > 0) {
            return String(Math.round(mhz * 1000));
        }

        const bandFrequency: Record<string, string> = {
            '160m': '1800',
            '80m': '3500',
            '60m': '5350',
            '40m': '7000',
            '30m': '10100',
            '20m': '14000',
            '17m': '18068',
            '15m': '21000',
            '12m': '24890',
            '10m': '28000',
            '6m': '50000',
            '2m': '144000',
            '70cm': '432000',
        };

        return bandFrequency[entry.band] ?? entry.band.toUpperCase();
    }

    private padCabrillo(value: string, width: number): string {
        return value.trim().replace(/\s+/g, ' ').slice(0, width).padEnd(width, ' ');
    }

    private parseDxLine(line: string): DxSpotRow | null {
        const cleaned = line.trim().replace(/\s+/g, ' ');
        if (!cleaned) return null;

        const leadingTime = cleaned.match(/^(\d{4}Z?)\s+([A-Z0-9/]+)\s+(\d+(?:\.\d+)?)\s+([A-Z0-9/]+)\s*(.*)$/i);
        const trailingTime = cleaned.match(/^([A-Z0-9/]+)\s+(\d+(?:\.\d+)?)\s+([A-Z0-9/]+)\s+(?:(\d{4}Z?)\s+)?(.*)$/i);

        if (!leadingTime && !trailingTime) return null;

        const time = leadingTime ? leadingTime[1] : trailingTime?.[4] ?? '';
        const spotter = leadingTime ? leadingTime[2] : trailingTime?.[1] ?? '';
        const rawFrequency = leadingTime ? leadingTime[3] : trailingTime?.[2] ?? '';
        const callsign = leadingTime ? leadingTime[4] : trailingTime?.[3] ?? '';
        const comment = leadingTime ? leadingTime[5] ?? '' : trailingTime?.[5] ?? '';
        const frequency = this.dxFrequencyToMhz(rawFrequency);

        return {
            time: time.toUpperCase(),
            spotter: this.normalizeCallsign(spotter),
            frequency,
            callsign: this.normalizeCallsign(callsign),
            comment,
            band: this.bandFromFrequencyMhz(frequency),
            mode: this.modeFromComment(comment.toUpperCase()),
            country: '',
        };
    }

    private mapDxSummitSpot(spot: DxSummitApiSpot): DxSpotRow | null {
        const callsign = this.normalizeCallsign(this.safeString(spot.dx_call));

        if (!callsign) return null;

        const comment = this.safeString(spot.info);
        const frequency = this.frequencyKhzToMhz(this.normalizeFrequency(spot.frequency));

        return {
            time: this.formatDxTime(this.safeString(spot.time)),
            spotter: this.normalizeCallsign(this.safeString(spot.de_call)),
            frequency,
            callsign,
            comment,
            band: this.bandFromFrequencyMhz(frequency),
            mode: this.modeFromComment(comment.toUpperCase()),
            country: this.safeString(spot.dx_country),
        };
    }

    private formatDxTime(value: string): string {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${hours}${minutes}Z`;
    }

    private dxFrequencyToMhz(value: string): string {
        const number = Number(value);
        if (Number.isNaN(number)) return value;

        const mhz = number > 1000 ? number / 1000 : number;
        return mhz.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
    }

    private modeFromComment(comment: string): string {
        if (comment.includes('FT8')) return 'FT8';
        if (comment.includes('FT4')) return 'FT4';
        if (comment.includes('CW')) return 'CW';
        if (comment.includes('RTTY')) return 'RTTY';
        if (comment.includes('FM')) return 'FM';
        if (comment.includes('AM')) return 'AM';
        if (comment.includes('SSB') || comment.includes('USB') || comment.includes('LSB')) return 'SSB';
        return '';
    }

    private bandFromFrequencyMhz(freq: string): string {
        const mhz = Number(freq);
        if (Number.isNaN(mhz)) return '';

        const bands: Array<[string, number, number]> = [
            ['160m', 1.8, 2],
            ['80m', 3.5, 4],
            ['60m', 5, 5.5],
            ['40m', 7, 7.3],
            ['30m', 10.1, 10.15],
            ['20m', 14, 14.35],
            ['17m', 18.068, 18.168],
            ['15m', 21, 21.45],
            ['12m', 24.89, 24.99],
            ['10m', 28, 29.7],
            ['6m', 50, 54],
            ['2m', 144, 148],
            ['70cm', 420, 450],
        ];

        return bands.find((band) => band[1] <= mhz && mhz <= band[2])?.[0] ?? '';
    }

    private async loadParkCache(prefix: string): Promise<Map<string, PotaPark>> {
        const parks = await firstValueFrom(this.http.get<PotaPark[]>(`${this.potaParksUrl}${encodeURIComponent(prefix)}`));
        const cache = new Map<string, PotaPark>();

        for (const park of parks) {
            if (park.reference) {
                cache.set(park.reference, park);
            }
        }

        return cache;
    }

    private parseProgramFilter(raw: string): Set<string> {
        const cleaned = raw.trim().toUpperCase();

        if (!cleaned || cleaned === 'ALL') {
            return new Set<string>();
        }

        return new Set(cleaned.split(',').map((part) => part.trim()).filter(Boolean));
    }

    private isProbablyInactive(spot: PotaSpot): boolean {
        const text = this.spotComment(spot).toLowerCase();
        const inactiveTerms = [
            'qrt',
            'q r t',
            'last call',
            'last calls',
            'final call',
            'final calls',
            'closing',
            'closed',
            'done',
            'packed up',
            'packing up',
            'leaving',
            'headed out',
            'shutting down',
            'shutdown',
            'qsy home',
        ];

        return inactiveTerms.some((term) => text.includes(term));
    }

    private spotComment(spot: PotaSpot): string {
        return [spot.comments, spot.comment, spot.spotterComments]
            .map((part) => this.safeString(part).trim())
            .filter(Boolean)
            .join(' | ');
    }

    private programPrefixFromReference(reference: string): string {
        return reference.includes('-') ? reference.split('-', 1)[0].toUpperCase() : '';
    }

    private normalizeFrequency(freq: number | string | undefined): string {
        if (freq === undefined || freq === null) return '';

        const text = String(freq).trim();
        const number = Number(text);

        if (Number.isNaN(number)) {
            return text;
        }

        return Number.isInteger(number)
            ? String(number)
            : number.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    }

    private frequencyKhzToMhz(freq: string): string {
        const khz = Number(freq);

        if (Number.isNaN(khz)) {
            return freq;
        }

        return (khz / 1000).toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
    }

    private bandFromFrequencyKhz(freq: number | string | undefined): string {
        const khz = Number(freq);

        if (Number.isNaN(khz)) {
            return '';
        }

        const mhz = khz / 1000;
        const bands: Array<[string, number, number]> = [
            ['160m', 1.8, 2],
            ['80m', 3.5, 4],
            ['60m', 5, 5.5],
            ['40m', 7, 7.3],
            ['30m', 10.1, 10.15],
            ['20m', 14, 14.35],
            ['17m', 18.068, 18.168],
            ['15m', 21, 21.45],
            ['12m', 24.89, 24.99],
            ['10m', 28, 29.7],
            ['6m', 50, 54],
            ['2m', 144, 148],
            ['70cm', 420, 450],
        ];

        return bands.find((band) => band[1] <= mhz && mhz <= band[2])?.[0] ?? '';
    }

    private haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const radiusMiles = 3958.7613;
        const toRadians = (degrees: number) => degrees * Math.PI / 180;
        const phi1 = toRadians(lat1);
        const phi2 = toRadians(lat2);
        const deltaPhi = toRadians(lat2 - lat1);
        const deltaLambda = toRadians(lon2 - lon1);
        const a =
            Math.sin(deltaPhi / 2) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

        return 2 * radiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private safeString(value: unknown, fallback = ''): string {
        return value === undefined || value === null ? fallback : String(value);
    }

    private blankSkipCounts(): PotaSkipCounts {
        return {
            inactive: 0,
            program: 0,
            mode: 0,
            band: 0,
            noCoordinates: 0,
            duplicates: 0,
        };
    }
}
