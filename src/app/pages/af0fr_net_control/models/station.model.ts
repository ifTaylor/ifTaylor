export type TrafficType =
    | 'none'
    | 'announcement'
    | 'formal'
    | 'priority'
    | 'emergency';

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
    trafficType: TrafficType;
    visitor: boolean;
    firstTime: boolean;
    notes?: string;
    status: StationStatus;
    checkInTime: string;
}