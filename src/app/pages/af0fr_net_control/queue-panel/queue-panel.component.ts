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

    @Output() moveUp = new EventEmitter<string>();
    @Output() moveDown = new EventEmitter<string>();
    @Output() activate = new EventEmitter<string>();
}