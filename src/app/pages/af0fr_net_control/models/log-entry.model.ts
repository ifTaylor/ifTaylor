export interface LogEntry {
    id: string;
    timestamp: string;
    type: 'info' | 'checkin' | 'traffic' | 'system';
    message: string;
    stationId?: string;
}