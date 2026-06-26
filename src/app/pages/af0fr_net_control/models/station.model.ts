import { ClubStatus } from './club-member.model';

export type TrafficType =
    | 'regular'
    | 'shortTime';

export type StationStatus =
    | 'waiting'
    | 'active'
    | 'complete'
    | 'skipped';

export interface Station {
    id: string;
    callsign: string;
    name?: string;
    location?: string;
    distance?: number;
    trafficType: TrafficType;
    clubStatus: ClubStatus;
    visitor: boolean;
    member: boolean;
    memberId?: string;
    firstTime: boolean;
    notes?: string;
    status: StationStatus;
    checkInTime: string;
}
