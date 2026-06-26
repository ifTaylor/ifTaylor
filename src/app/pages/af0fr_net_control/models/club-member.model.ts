export type ClubStatus = 'member' | 'visitor' | 'unknown';

export interface ClubMember {
    id: string;
    callsign: string;
    name: string;
    city?: string;
    notes?: string;
    status: ClubStatus;
    source: 'seed' | 'manual';
}
