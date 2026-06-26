import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CheckinForm } from './checkin-form/checkin-form.component';
import { StationList } from './station-list/station-list.component';
import { QueuePanel } from './queue-panel/queue-panel.component';
import { ScriptPanel } from './script-panel/script-panel.component';
import { SessionLog } from './session-log/session-log.component';
import { Station } from './models/station.model';
import { LogEntry } from './models/log-entry.model';
import { ClubMember, ClubStatus } from './models/club-member.model';
import { JCARC_ROSTER } from './data/jcarc-roster';
import { RosterCheckInRequest, RosterTable } from './roster-table.component';

interface SavedNetControlSession {
    id: string;
    name: string;
    savedAt: string;
    openingScript: string;
    trafficPrompt: string;
    lateCheckinPrompt: string;
    closingScript: string;
    roster?: ClubMember[];
    stations: Station[];
    queue: Station[];
    logEntries: LogEntry[];
}

interface NetControlStateResponse {
    payload: Omit<SavedNetControlSession, 'id' | 'name' | 'savedAt'>;
    updatedAt: string;
}

@Component({
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CheckinForm,
        StationList,
        QueuePanel,
        ScriptPanel,
        SessionLog,
        RosterTable
    ],
    templateUrl: './af0fr_net_control.page.html',
})
export class Af0frNetControlPage implements OnInit, OnDestroy {
    private readonly autosaveKey = 'af0fr-net-control-autosave';
    private readonly savedSessionsKey = 'af0fr-net-control-saved-sessions';
    private readonly manualRosterKey = 'af0fr-net-control-manual-roster';

    private readonly scriptVersionKey = 'af0fr-net-control-script-version';
    private readonly currentScriptVersion = 'jcarc-monday-practice-net-2026-06';

    private readonly defaultOpeningScript =
        'Good evening, this is AF0FR. My QTH is Oakville, Missouri, and I will serve as net control tonight for the Jefferson County Amateur Radio Club Emergency Practice Net. Is there anyone that needs to use the repeater before we begin?';

    private readonly defaultTrafficPrompt =
        'This is AF0FR, tonight’s net control operator for the Jefferson County Amateur Radio Club Emergency Practice Net. Our club call sign is KB0TLL. In preparation for emergency communications, this net meets every Monday at 8 PM Central time. This repeater is found at 147.075 megahertz with a tone of 141.3 and is located about 4 miles north of Hillsboro, Missouri, in Jefferson County.';

    private readonly defaultLateCheckinPrompt =
        'We will now take check-ins. Please check in with your name, call sign, and location. We will take check-ins in this order: mobiles and portables, short time, regular check-ins, and then president comments. Mobiles and portables, please call now.';

    private readonly defaultClosingScript =
        'Are there any late or missed check-ins? Please call now. Hearing none, this is AF0FR closing the Jefferson County Amateur Radio Club Monday Night Emergency Practice Net and returning the repeater to normal use. This is AF0FR clear.';

    private pollSubscription?: Subscription;
    private lastRemoteUpdatedAt = '';
    private isSavingRemote = false;

    openingScript = this.defaultOpeningScript;
    trafficPrompt = this.defaultTrafficPrompt;
    lateCheckinPrompt = this.defaultLateCheckinPrompt;
    closingScript = this.defaultClosingScript;

    stations: Station[] = [];
    queue: Station[] = [];
    logEntries: LogEntry[] = [];
    manualRoster: ClubMember[] = [];
    clubMembers: ClubMember[] = JCARC_ROSTER;
    rosterSearchCallsign = '';
    backendOnline = false;
    rosterEditing = false;

    savedSessions: SavedNetControlSession[] = [];
    selectedSavedSessionId = '';

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        this.loadManualRoster();
        this.loadSavedSessions();
        this.restoreAutosave();

        const storedScriptVersion = localStorage.getItem(this.scriptVersionKey);

        if (storedScriptVersion !== this.currentScriptVersion) {
            this.resetScriptsToCurrentDefaults();
            localStorage.setItem(this.scriptVersionKey, this.currentScriptVersion);
            this.persistState();
        }

        this.loadSharedState(true);
        this.pollSubscription = interval(2500).subscribe(() => this.loadSharedState(false));
    }

    ngOnDestroy(): void {
        this.pollSubscription?.unsubscribe();
    }

    get checkedInCallsigns(): Set<string> {
        return new Set(this.stations.map((station) => station.callsign).filter(Boolean));
    }

    onCallsignSearch(callsign: string): void {
        this.rosterSearchCallsign = this.normalizeCallsign(callsign);
    }

    onStationAdded(station: Station): void {
        const normalizedStation = this.normalizeStation({
            ...station,
            status: station.trafficType === 'shortTime' ? 'complete' : station.status,
        });

        this.upsertManualMember(normalizedStation);

        this.stations = [...this.stations, normalizedStation];
        this.queue = [...this.queue, normalizedStation];

        this.addLog(
            'checkin',
            `${normalizedStation.callsign || normalizedStation.name} checked in as ${this.statusLabel(normalizedStation.clubStatus)} for ${this.trafficLabel(normalizedStation.trafficType)}.`,
            normalizedStation.id
        );

        this.persistState();
    }

    confirmCheckIn(stationId: string): void {
        const target = this.queue.find((station) => station.id === stationId);
        if (!target) return;

        this.queue = this.queue.filter((station) => station.id !== stationId);
        this.addLog('info', `${target.callsign || target.name} confirmed in recall.`, stationId);
        this.persistState();
    }

    checkInRosterMember(request: RosterCheckInRequest): void {
        const { member, trafficType } = request;
        if (member.callsign && this.checkedInCallsigns.has(member.callsign)) return;

        this.onStationAdded({
            id: crypto.randomUUID(),
            callsign: member.callsign,
            name: member.name,
            location: member.city ?? '',
            trafficType,
            clubStatus: member.status,
            visitor: member.status === 'visitor',
            member: member.status === 'member',
            memberId: member.id,
            firstTime: member.status === 'unknown',
            notes: member.notes ?? '',
            status: 'waiting',
            checkInTime: new Date().toISOString(),
        });
    }

    updateRosterMember(member: ClubMember): void {
        const normalizedMember = this.normalizeMember(member);
        if (!normalizedMember) return;

        this.clubMembers = this.clubMembers.map((entry) =>
            entry.id === normalizedMember.id ? normalizedMember : entry
        );

        this.stations = this.stations.map((station) =>
            station.memberId === normalizedMember.id
                ? this.normalizeStation({
                    ...station,
                    callsign: normalizedMember.callsign,
                    name: normalizedMember.name,
                    location: normalizedMember.city ?? '',
                    clubStatus: normalizedMember.status,
                })
                : station
        );
        this.queue = this.queue.map((station) =>
            station.memberId === normalizedMember.id
                ? this.normalizeStation({
                    ...station,
                    callsign: normalizedMember.callsign,
                    name: normalizedMember.name,
                    location: normalizedMember.city ?? '',
                    clubStatus: normalizedMember.status,
                })
                : station
        );

        this.persistState();
    }

    removeRosterMember(member: ClubMember): void {
        const label = member.callsign || member.name;
        const confirmed = window.confirm(`Remove ${label} from the roster?`);
        if (!confirmed) return;

        this.clubMembers = this.clubMembers.filter((entry) => entry.id !== member.id);
        this.stations = this.stations.filter((station) => station.memberId !== member.id);
        this.queue = this.queue.filter((station) => station.memberId !== member.id);
        this.addLog('system', `${label} removed from roster.`);
        this.persistState();
    }

    toggleRosterEditing(): void {
        this.rosterEditing = !this.rosterEditing;
    }

    setActiveStation(stationId: string): void {
        const target = this.stations.find((station) => station.id === stationId);
        if (!target) return;

        this.stations = this.stations.map((station) => {
            if (station.id === stationId) {
                return { ...station, status: 'active' };
            }

            if (station.status === 'active') {
                return { ...station, status: 'waiting' };
            }

            return station;
        });

        this.queue = this.queue.filter((station) => station.id !== stationId);

        this.addLog('info', `Recognized ${target.callsign || target.name}.`, stationId);
        this.persistState();
    }

    markStationComplete(stationId: string): void {
        const target = this.stations.find((station) => station.id === stationId);
        if (!target) return;

        this.stations = this.stations.map((station) =>
            station.id === stationId
                ? { ...station, status: 'complete' }
                : station
        );

        this.queue = this.queue.filter((station) => station.id !== stationId);

        this.addLog('info', `${target.callsign || target.name} marked complete.`, stationId);
        this.persistState();
    }

    saveCurrentSession(): void {
        const defaultName = `Net ${new Date().toLocaleString()}`;
        const name = window.prompt('Save this net as:', defaultName)?.trim();

        if (!name) return;

        const session: SavedNetControlSession = {
            ...this.buildSessionSnapshot(),
            id: crypto.randomUUID(),
            name,
            savedAt: new Date().toISOString(),
        };

        const existing = this.getStoredSessions();
        const updated = [session, ...existing];

        localStorage.setItem(this.savedSessionsKey, JSON.stringify(updated));
        this.savedSessions = updated;
        this.selectedSavedSessionId = session.id;
    }

    loadSelectedSession(): void {
        if (!this.selectedSavedSessionId) return;

        const target = this.savedSessions.find(
            (session) => session.id === this.selectedSavedSessionId
        );

        if (!target) return;

        this.applySession(target);
        this.persistState();
    }

    deleteSelectedSession(): void {
        if (!this.selectedSavedSessionId) return;

        const updated = this.savedSessions.filter(
            (session) => session.id !== this.selectedSavedSessionId
        );

        localStorage.setItem(this.savedSessionsKey, JSON.stringify(updated));
        this.savedSessions = updated;
        this.selectedSavedSessionId = '';
    }

    exportCurrentSession(): void {
        const snapshot: SavedNetControlSession = {
            ...this.buildSessionSnapshot(),
            id: crypto.randomUUID(),
            name: `Net Export ${new Date().toLocaleString()}`,
            savedAt: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
            type: 'application/json',
        });

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        anchor.href = url;
        anchor.download = `net-control-${timestamp}.json`;
        anchor.click();

        URL.revokeObjectURL(url);
    }

    async importSession(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as SavedNetControlSession;

            if (
                !parsed ||
                !Array.isArray(parsed.stations) ||
                !Array.isArray(parsed.queue) ||
                !Array.isArray(parsed.logEntries)
            ) {
                throw new Error('Invalid net control session file.');
            }

            this.applySession(parsed);
            this.persistState();
        } catch (error) {
            console.error(error);
            window.alert('Could not import that file.');
        } finally {
            input.value = '';
        }
    }

    clearCurrentSession(): void {
        const confirmed = window.confirm(
            'Clear the current net session? This only clears the active session.'
        );

        if (!confirmed) return;

        this.stations = [];
        this.queue = [];
        this.logEntries = [];
        this.persistState();
    }

    private addLog(
        type: LogEntry['type'],
        message: string,
        stationId?: string
    ): void {
        const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type,
            message,
            stationId,
        };

        this.logEntries = [entry, ...this.logEntries];
    }

    private buildSessionSnapshot(): Omit<SavedNetControlSession, 'id' | 'name' | 'savedAt'> {
        return {
            openingScript: this.openingScript,
            trafficPrompt: this.trafficPrompt,
            lateCheckinPrompt: this.lateCheckinPrompt,
            closingScript: this.closingScript,
            roster: this.clubMembers,
            stations: this.stations,
            queue: this.queue,
            logEntries: this.logEntries,
        };
    }

    private applySession(session: Partial<Omit<SavedNetControlSession, 'id' | 'name' | 'savedAt'>>): void {
        this.openingScript = session.openingScript ?? this.openingScript;
        this.trafficPrompt = session.trafficPrompt ?? this.trafficPrompt;
        this.lateCheckinPrompt = session.lateCheckinPrompt ?? this.lateCheckinPrompt;
        this.closingScript = session.closingScript ?? this.closingScript;
        this.clubMembers = this.normalizeRoster(session.roster);
        this.stations = (session.stations ?? []).map((station) => this.normalizeStation(station));
        this.queue = (session.queue ?? []).map((station) => this.normalizeStation(station));
        this.logEntries = session.logEntries ?? [];
    }

    private loadSharedState(initialLoad: boolean): void {
        this.http.get<NetControlStateResponse>(`${environment.apiUrl}/net-control/state`).subscribe({
            next: (state) => {
                this.backendOnline = true;

                if (!state.payload || Object.keys(state.payload).length === 0) {
                    if (initialLoad) {
                        this.saveSharedState();
                    }
                    return;
                }

                if (this.isSavingRemote || state.updatedAt === this.lastRemoteUpdatedAt) {
                    return;
                }

                this.lastRemoteUpdatedAt = state.updatedAt;

                const storedScriptVersion = localStorage.getItem(this.scriptVersionKey);

                if (storedScriptVersion === this.currentScriptVersion) {
                    this.applySession({
                        ...state.payload,
                        openingScript: this.openingScript,
                        trafficPrompt: this.trafficPrompt,
                        lateCheckinPrompt: this.lateCheckinPrompt,
                        closingScript: this.closingScript,
                    });
                    return;
                }

                this.applySession(state.payload);
            },
            error: (error) => {
                this.backendOnline = false;
                if (initialLoad) {
                    console.error('Failed to load shared net control state', error);
                }
            },
        });
    }

    private saveSharedState(): void {
        this.isSavingRemote = true;
        this.http.put<NetControlStateResponse>(
            `${environment.apiUrl}/net-control/state`,
            { payload: this.buildSessionSnapshot() }
        ).subscribe({
            next: (state) => {
                this.backendOnline = true;
                this.lastRemoteUpdatedAt = state.updatedAt;
                this.isSavingRemote = false;
            },
            error: (error) => {
                this.backendOnline = false;
                this.isSavingRemote = false;
                console.error('Failed to save shared net control state', error);
            },
        });
    }

    private loadManualRoster(): void {
        const raw = localStorage.getItem(this.manualRosterKey);

        if (!raw) {
            this.syncClubMembers();
            return;
        }

        try {
            const parsed = JSON.parse(raw);
            this.manualRoster = Array.isArray(parsed)
                ? parsed.map((member) => this.normalizeMember(member)).filter(Boolean) as ClubMember[]
                : [];
        } catch (error) {
            console.error('Failed to load manual roster', error);
            this.manualRoster = [];
        }

        this.syncClubMembers();
    }

    private upsertManualMember(station: Station): void {
        const existingIndex = station.callsign
            ? this.clubMembers.findIndex((entry) => entry.callsign === station.callsign)
            : -1;
        const existing = existingIndex >= 0 ? this.clubMembers[existingIndex] : undefined;
        const member: ClubMember = {
            id: existing?.id ?? station.memberId ?? `manual-${station.callsign || crypto.randomUUID()}`.toLowerCase(),
            callsign: station.callsign,
            name: station.name?.trim() || existing?.name || station.callsign,
            city: station.location?.trim() || existing?.city || undefined,
            notes: station.notes?.trim() || existing?.notes || undefined,
            status: station.clubStatus,
            source: existing?.source ?? 'manual',
        };

        if (existingIndex >= 0) {
            this.clubMembers = this.clubMembers.map((entry, index) =>
                index === existingIndex ? { ...entry, ...member } : entry
            );
        } else {
            this.clubMembers = [...this.clubMembers, member];
        }
    }

    private syncClubMembers(): void {
        const seededCallsigns = new Set(JCARC_ROSTER.map((member) => member.callsign).filter(Boolean));
        const manualOnly = this.manualRoster.filter(
            (member) => member.callsign && !seededCallsigns.has(member.callsign)
        );

        this.clubMembers = [...JCARC_ROSTER, ...manualOnly];
    }

    private normalizeStation(station: Station): Station {
        const callsign = this.normalizeCallsign(station.callsign);
        const member = this.clubMembers.find(
            (entry) => entry.id === station.memberId || entry.callsign === callsign
        );
        const trafficType = this.normalizeTrafficType(station.trafficType);
        const clubStatus = this.normalizeStatus(
            station.clubStatus ??
            member?.status ??
            (station.member ? 'member' : station.firstTime ? 'unknown' : 'visitor')
        );

        return {
            ...station,
            callsign,
            name: station.name?.trim() || member?.name || '',
            location: station.location?.trim() || member?.city || '',
            trafficType,
            clubStatus,
            member: clubStatus === 'member',
            memberId: member?.id ?? station.memberId,
            visitor: clubStatus === 'visitor',
            firstTime: clubStatus === 'unknown',
            status: trafficType === 'shortTime' ? 'complete' : station.status,
        };
    }

    private normalizeRoster(roster: ClubMember[] | undefined): ClubMember[] {
        const incoming = roster?.length ? roster : JCARC_ROSTER;
        const normalized = incoming
            .map((member) => this.normalizeMember(member))
            .filter((member): member is ClubMember => !!member);
        const callsigns = new Set(normalized.map((member) => member.callsign).filter(Boolean));
        const seededIds = new Set(normalized.map((member) => member.id));
        const missingSeedRows = JCARC_ROSTER.filter(
            (member) =>
                !seededIds.has(member.id) &&
                (!member.callsign || !callsigns.has(member.callsign))
        );

        return [...normalized, ...missingSeedRows];
    }

    private normalizeMember(value: unknown): ClubMember | null {
        if (!value || typeof value !== 'object') {
            return null;
        }

        const member = value as Partial<ClubMember> & { location?: string };
        const callsign = this.normalizeCallsign(member.callsign ?? '');
        const name = member.name?.trim() || callsign;

        if (!name) {
            return null;
        }

        return {
            id: member.id ?? `manual-${callsign || crypto.randomUUID()}`.toLowerCase(),
            callsign,
            name,
            city: member.city?.trim() || member.location?.trim() || undefined,
            notes: member.notes?.trim() || undefined,
            status: this.normalizeStatus(member.status),
            source: member.source ?? 'manual',
        };
    }

    private normalizeStatus(value: unknown): ClubStatus {
        if (value === 'firstTime') {
            return 'unknown';
        }

        return value === 'member' || value === 'unknown' || value === 'visitor'
            ? value
            : 'visitor';
    }

    private normalizeTrafficType(value: unknown): Station['trafficType'] {
        return value === 'shortTime' ? 'shortTime' : 'regular';
    }

    private statusLabel(status: ClubStatus): string {
        switch (status) {
            case 'member':
                return 'member';
            case 'unknown':
                return 'unknown';
            default:
                return 'visitor';
        }
    }

    private trafficLabel(trafficType: Station['trafficType']): string {
        return trafficType === 'shortTime' ? 'short time' : 'regular';
    }

    private normalizeCallsign(value: string): string {
        return value.trim().toUpperCase().replace(/Ø/g, '0');
    }

    private resetScriptsToCurrentDefaults(): void {
        this.openingScript = this.defaultOpeningScript;
        this.trafficPrompt = this.defaultTrafficPrompt;
        this.lateCheckinPrompt = this.defaultLateCheckinPrompt;
        this.closingScript = this.defaultClosingScript;
    }

    private persistState(): void {
        const snapshot = {
            ...this.buildSessionSnapshot(),
            savedAt: new Date().toISOString(),
        };

        localStorage.setItem(this.autosaveKey, JSON.stringify(snapshot));
        this.saveSharedState();
    }

    private restoreAutosave(): void {
        const raw = localStorage.getItem(this.autosaveKey);
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw);
            this.applySession(parsed);
        } catch (error) {
            console.error('Failed to restore autosave', error);
        }
    }

    private loadSavedSessions(): void {
        this.savedSessions = this.getStoredSessions();
    }

    private getStoredSessions(): SavedNetControlSession[] {
        const raw = localStorage.getItem(this.savedSessionsKey);
        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Failed to load saved sessions', error);
            return [];
        }
    }
}