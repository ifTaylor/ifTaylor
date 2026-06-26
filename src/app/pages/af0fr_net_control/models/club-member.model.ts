export type ClubStatus = 'member' | 'visitor' | 'unknown';

export interface ClubMember {
    id: string;
    callsign: string;
    name: string;
    city?: string;
    lat?: number;
    lng?: number;
    distanceMiles?: number;
    notes?: string;
    status: ClubStatus;
    source: 'seed' | 'manual';
}
