import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckinForm } from './checkin-form/checkin-form.component';
import { StationList } from './station-list/station-list.component';
import { QueuePanel } from './queue-panel/queue-panel.component';
import { ScriptPanel } from './script-panel/script-panel.component';
import { SessionLog } from './session-log/session-log.component';
import { Station } from './models/station.model';
import { LogEntry } from './models/log-entry.model';

interface SavedNetControlSession {
    id: string;
    name: string;
    savedAt: string;
    openingScript: string;
    trafficPrompt: string;
    lateCheckinPrompt: string;
    closingScript: string;
    stations: Station[];
    queue: Station[];
    logEntries: LogEntry[];
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
    ],
    templateUrl: './af0fr_net_control.page.html',
})
export class Af0frNetControlPage implements OnInit {
    private readonly autosaveKey = 'af0fr-net-control-autosave';
    private readonly savedSessionsKey = 'af0fr-net-control-saved-sessions';

    openingScript =
        'Good evening. This is AF0FR, net control for tonight’s net. This net is now open for check-ins.';
    trafficPrompt =
        'Any stations with emergency or priority traffic, please call now.';
    lateCheckinPrompt =
        'Any late or missed check-ins, please come now with your callsign slowly and clearly.';
    closingScript =
        'Hearing no further traffic, this net is now closed. Thanks to all who checked in. This is AF0FR clear.';

    stations: Station[] = [];
    queue: Station[] = [];
    logEntries: LogEntry[] = [];

    savedSessions: SavedNetControlSession[] = [];
    selectedSavedSessionId = '';

    ngOnInit(): void {
        this.loadSavedSessions();
        this.restoreAutosave();
    }

    onStationAdded(station: Station): void {
        this.stations = [...this.stations, station];
        this.queue = [...this.queue, station];

        this.addLog(
            'checkin',
            `${station.callsign} checked in${station.trafficType !== 'none' ? ` with ${station.trafficType} traffic` : ''}.`,
            station.id
        );

        this.persistState();
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

        this.addLog('info', `Recognized ${target.callsign}.`, stationId);
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

        this.addLog('info', `${target.callsign} marked complete.`, stationId);
        this.persistState();
    }

    removeStation(stationId: string): void {
        const target = this.stations.find((station) => station.id === stationId);
        if (!target) return;

        this.stations = this.stations.filter((station) => station.id !== stationId);
        this.queue = this.queue.filter((station) => station.id !== stationId);

        this.addLog('system', `${target.callsign} removed from session.`, stationId);
        this.persistState();
    }

    moveQueueUp(stationId: string): void {
        const index = this.queue.findIndex((station) => station.id === stationId);
        if (index <= 0) return;

        const updatedQueue = [...this.queue];
        [updatedQueue[index - 1], updatedQueue[index]] = [
            updatedQueue[index],
            updatedQueue[index - 1],
        ];

        this.queue = updatedQueue;
        this.persistState();
    }

    moveQueueDown(stationId: string): void {
        const index = this.queue.findIndex((station) => station.id === stationId);
        if (index < 0 || index >= this.queue.length - 1) return;

        const updatedQueue = [...this.queue];
        [updatedQueue[index], updatedQueue[index + 1]] = [
            updatedQueue[index + 1],
            updatedQueue[index],
        ];

        this.queue = updatedQueue;
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
            stations: this.stations,
            queue: this.queue,
            logEntries: this.logEntries,
        };
    }

    private applySession(session: Omit<SavedNetControlSession, 'id' | 'name' | 'savedAt'>): void {
        this.openingScript = session.openingScript;
        this.trafficPrompt = session.trafficPrompt;
        this.lateCheckinPrompt = session.lateCheckinPrompt;
        this.closingScript = session.closingScript;
        this.stations = session.stations ?? [];
        this.queue = session.queue ?? [];
        this.logEntries = session.logEntries ?? [];
    }

    private persistState(): void {
        const snapshot = {
            ...this.buildSessionSnapshot(),
            savedAt: new Date().toISOString(),
        };

        localStorage.setItem(this.autosaveKey, JSON.stringify(snapshot));
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