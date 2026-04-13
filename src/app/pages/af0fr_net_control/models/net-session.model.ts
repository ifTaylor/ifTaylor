export interface NetSession {
    id: string;
    netName: string;
    frequency: string;
    mode: string;
    operatorCallsign: string;
    status: 'idle' | 'active' | 'closed';
    startTime?: string;
    endTime?: string;
}