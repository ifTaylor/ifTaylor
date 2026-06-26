import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Station } from '../models/station.model';

@Component({
    selector: 'queue-panel',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './queue-panel.component.html',
})
export class QueuePanel {
    @Input({ required: true }) queue: Station[] = [];

    @Output() confirm = new EventEmitter<string>();
}
