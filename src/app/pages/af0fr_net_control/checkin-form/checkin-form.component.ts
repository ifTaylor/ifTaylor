import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Station } from '../models/station.model';

@Component({
    selector: 'checkin-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './checkin-form.component.html',
})
export class CheckinForm {
    @Output() stationAdded = new EventEmitter<Station>();

    constructor(private fb: FormBuilder) {}

    form = this.fb.group({
        callsign: ['', Validators.required],
        name: [''],
        location: [''],
        trafficType: ['none' as Station['trafficType']],
        visitor: [false],
        firstTime: [false],
        notes: [''],
    });

    submit(): void {
        if (this.form.invalid) return;

        const value = this.form.getRawValue();

        const station: Station = {
            id: crypto.randomUUID(),
            callsign: value.callsign?.trim().toUpperCase() ?? '',
            name: value.name?.trim() ?? '',
            location: value.location?.trim() ?? '',
            trafficType: value.trafficType ?? 'none',
            visitor: !!value.visitor,
            firstTime: !!value.firstTime,
            notes: value.notes?.trim() ?? '',
            status: 'waiting',
            checkInTime: new Date().toISOString(),
        };

        this.stationAdded.emit(station);
        this.form.reset({
            callsign: '',
            name: '',
            location: '',
            trafficType: 'none',
            visitor: false,
            firstTime: false,
            notes: '',
        });
    }
}