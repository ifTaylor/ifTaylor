import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
    selector: 'script-panel',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './script-panel.component.html',
})
export class ScriptPanel {
    @Input() openingScript = '';
    @Input() trafficPrompt = '';
    @Input() lateCheckinPrompt = '';
    @Input() closingScript = '';
}