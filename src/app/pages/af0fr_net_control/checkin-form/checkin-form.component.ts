import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClubStatus } from '../models/club-member.model';
import { Station } from '../models/station.model';

@Component({
    selector: 'checkin-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './checkin-form.component.html',
})
export class CheckinForm {
    @Output() callsignChanged = new EventEmitter<string>();
    @Output() stationAdded = new EventEmitter<Station>();

    constructor(private fb: FormBuilder) {}

    form = this.fb.group({
        callsign: ['', Validators.required],
        name: [''],
        location: [''],
        trafficType: ['shortTime' as Station['trafficType']],
        clubStatus: ['visitor' as ClubStatus],
        notes: [''],
    });

    updateCallsignSearch(): void {
        this.callsignChanged.emit(this.normalizeCallsign(this.form.controls.callsign.value));
    }

    setTrafficType(trafficType: Station['trafficType']): void {
        this.form.patchValue({ trafficType });
    }

    toggleTrafficType(): void {
        this.setTrafficType(
            this.form.controls.trafficType.value === 'shortTime'
                ? 'regular'
                : 'shortTime'
        );
    }

    setClubStatus(clubStatus: ClubStatus): void {
        this.form.patchValue({ clubStatus });
    }

    submit(): void {
        if (this.form.invalid) return;

        const value = this.form.getRawValue();
        const callsign = this.normalizeCallsign(value.callsign);
        const clubStatus = value.clubStatus ?? 'visitor';
        const isMember = clubStatus === 'member';

        const station: Station = {
            id: crypto.randomUUID(),
            callsign,
            name: value.name?.trim() ?? '',
            location: value.location?.trim() ?? '',
            trafficType: value.trafficType ?? 'regular',
            clubStatus,
            visitor: clubStatus === 'visitor',
            member: isMember,
            firstTime: clubStatus === 'unknown',
            notes: value.notes?.trim() ?? '',
            status: 'waiting',
            checkInTime: new Date().toISOString(),
        };

        this.stationAdded.emit(station);
        this.callsignChanged.emit('');
        this.form.reset({
            callsign: '',
            name: '',
            location: '',
            trafficType: 'shortTime',
            clubStatus: 'visitor',
            notes: '',
        });
    }

    private normalizeCallsign(value: string | null | undefined): string {
        return (value ?? '').trim().toUpperCase().replace(/Ø/g, '0');
    }

    normalizeCallsignInput(): void {
    const control = this.form.controls.callsign;
    const normalized = this.normalizeCallsign(control.value);

    if (control.value !== normalized) {
        control.setValue(normalized, { emitEvent: false });
    }

    this.callsignChanged.emit(normalized);
}
}
