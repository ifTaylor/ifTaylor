import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
    ViewChild,
} from '@angular/core';
import { ClubMember, ClubStatus } from './models/club-member.model';
import { TrafficType } from './models/station.model';

export interface RosterCheckInRequest {
    member: ClubMember;
    trafficType: TrafficType;
}

@Component({
    selector: 'roster-table',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './roster-table.component.html',
})
export class RosterTable implements AfterViewInit, OnChanges {
    @Input({ required: true }) roster: ClubMember[] = [];
    @Input() searchCallsign = '';
    @Input() checkedInCallsigns = new Set<string>();
    @Input() editing = false;
    @Input() pendingRemoveMemberId = '';
    @Input() removingMemberId = '';

    @Output() checkIn = new EventEmitter<RosterCheckInRequest>();
    @Output() memberChange = new EventEmitter<ClubMember>();
    @Output() memberRemove = new EventEmitter<ClubMember>();

    @ViewChild('scrollBody') private scrollBody?: ElementRef<HTMLDivElement>;

    highlightedMemberId = '';
    private viewReady = false;
    private drafts = new Map<string, Pick<ClubMember, 'callsign' | 'name' | 'city'>>();

    get displayRoster(): ClubMember[] {
        return [...this.roster].sort((a, b) => {
            const aCall = a.callsign || 'ZZZZZZ';
            const bCall = b.callsign || 'ZZZZZZ';
            const byCallsign = aCall.localeCompare(bCall);

            return byCallsign || a.name.localeCompare(b.name);
        });
    }

    ngAfterViewInit(): void {
        this.viewReady = true;
        this.updateHighlight();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['roster'] || changes['searchCallsign']) {
            this.updateHighlight();
        }

        if (changes['editing'] || changes['roster']) {
            this.syncDrafts();
        }
    }

    isCheckedIn(member: ClubMember): boolean {
        return !!member.callsign && this.checkedInCallsigns.has(member.callsign);
    }

    removeButtonLabel(member: ClubMember): string {
        if (this.removingMemberId === member.id) {
            return 'Removing...';
        }

        return this.pendingRemoveMemberId === member.id ? 'Confirm' : 'Remove';
    }

    statusLabel(status: ClubStatus): string {
        switch (status) {
            case 'unknown':
                return 'Unknown';
            case 'visitor':
                return 'Visitor';
            default:
                return 'Member';
        }
    }

    statusClass(status: ClubStatus): string {
        switch (status) {
            case 'unknown':
                return 'bg-blue-600 text-white';
            case 'visitor':
                return 'bg-slate-600 text-white';
            default:
                return 'bg-orange-500 text-white';
        }
    }

    trackByMemberId(_index: number, member: ClubMember): string {
        return member.id;
    }

    draftValue(member: ClubMember, field: keyof Pick<ClubMember, 'callsign' | 'name' | 'city'>): string {
        return this.drafts.get(member.id)?.[field] ?? member[field] ?? '';
    }

    updateDraft(member: ClubMember, field: keyof Pick<ClubMember, 'callsign' | 'name' | 'city'>, value: string): void {
        const draft = this.drafts.get(member.id) ?? {
            callsign: member.callsign,
            name: member.name,
            city: member.city ?? '',
        };

        this.drafts.set(member.id, { ...draft, [field]: value });
    }

    commitDraft(member: ClubMember): void {
        const draft = this.drafts.get(member.id);
        if (!draft) return;

        const callsign = draft.callsign.trim().toUpperCase().replace(/Ø/g, '0').replace(/Ã˜/g, '0');
        const name = draft.name.trim();
        const city = draft.city?.trim() ?? '';

        if (callsign === member.callsign && name === member.name && city === (member.city ?? '')) {
            return;
        }

        this.memberChange.emit({ ...member, callsign, name, city });
    }

    updateMember(member: ClubMember, changes: Partial<ClubMember>): void {
        this.memberChange.emit({
            ...member,
            ...changes,
            callsign: changes.callsign !== undefined
                ? changes.callsign.trim().toUpperCase().replace(/Ø/g, '0').replace(/Ã˜/g, '0')
                : member.callsign,
            name: changes.name !== undefined ? changes.name.trim() : member.name,
            city: changes.city !== undefined ? changes.city.trim() : member.city,
        });
    }

    private syncDrafts(): void {
        if (!this.editing) {
            this.drafts.clear();
            return;
        }

        const rosterIds = new Set(this.roster.map((member) => member.id));

        for (const member of this.roster) {
            if (!this.drafts.has(member.id)) {
                this.drafts.set(member.id, {
                    callsign: member.callsign,
                    name: member.name,
                    city: member.city ?? '',
                });
            }
        }

        for (const memberId of this.drafts.keys()) {
            if (!rosterIds.has(memberId)) {
                this.drafts.delete(memberId);
            }
        }
    }

    private updateHighlight(): void {
        const query = this.searchCallsign.trim().toUpperCase();

        if (!query) {
            this.highlightedMemberId = '';
            return;
        }

        const match = this.displayRoster.find((member) =>
            member.callsign.toUpperCase().startsWith(query)
        );

        this.highlightedMemberId = match?.id ?? '';

        if (this.viewReady && this.highlightedMemberId) {
            queueMicrotask(() => this.scrollHighlightedIntoView());
        }
    }

    private scrollHighlightedIntoView(): void {
        const container = this.scrollBody?.nativeElement;
        if (!container) return;

        const row = container.querySelector<HTMLElement>(
            `[data-member-id="${this.highlightedMemberId}"]`
        );
        row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
}
