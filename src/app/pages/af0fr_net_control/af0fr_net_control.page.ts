import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, interval, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CheckinForm } from './checkin-form/checkin-form.component';
import { StationList } from './station-list/station-list.component';
import { QueuePanel } from './queue-panel/queue-panel.component';
import { ScriptPanel } from './script-panel/script-panel.component';
import { SessionLog } from './session-log/session-log.component';
import { Station } from './models/station.model';
import { LogEntry } from './models/log-entry.model';
import { ClubMember, ClubStatus } from './models/club-member.model';
import { RosterCheckInRequest, RosterTable } from './roster-table.component';

interface SavedNetControlSession {
    id: string;
    name: string;
    savedAt: string;
    openingScript: string;
    trafficPrompt: string;
    lateCheckinPrompt: string;
    closingScript: string;
    stations: Station[];
    queue: Station[];
    logEntries: LogEntry[];
}

interface NetControlSharedPayload extends Omit<SavedNetControlSession, 'id' | 'name' | 'savedAt'> {
    savedSessions?: SavedNetControlSession[];
}

interface NetControlStateResponse {
    payload: NetControlSharedPayload;
    updatedAt: string;
}

@Component({
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CheckinForm,
        StationList,
        QueuePanel,
        ScriptPanel,
        SessionLog,
        RosterTable
    ],
    templateUrl: './af0fr_net_control.page.html',
})
export class Af0frNetControlPage implements OnInit, OnDestroy {
    private readonly scriptVersionKey = 'af0fr-net-control-script-version';
    private readonly currentScriptVersion = 'jcarc-monday-practice-net-2026-06';

    private readonly defaultOpeningScript =
        'Good evening, this is AF0FR. My QTH is Oakville, Missouri, and I will serve as net control tonight for the Jefferson County Amateur Radio Club Emergency Practice Net. Is there anyone that needs to use the repeater before we begin?';

    private readonly defaultTrafficPrompt =
        'This is AF0FR, tonight’s net control operator for the Jefferson County Amateur Radio Club Emergency Practice Net. Our club call sign is KB0TLL. In preparation for emergency communications, this net meets every Monday at 8 PM Central time. This repeater is found at 147.075 megahertz with a tone of 141.3 and is located about 4 miles north of Hillsboro, Missouri, in Jefferson County.';

    private readonly defaultLateCheckinPrompt =
        'We will now take check-ins. Please check in with your name, call sign, and location. We will take check-ins in this order: mobiles and portables, short time, regular check-ins, and then president comments. Mobiles and portables, please call now.';

    private readonly defaultClosingScript =
        'Are there any late or missed check-ins? Please call now. Hearing none, this is AF0FR closing the Jefferson County Amateur Radio Club Monday Night Emergency Practice Net and returning the repeater to normal use. This is AF0FR clear.';

    private pollSubscription?: Subscription;
    private lastRemoteUpdatedAt = '';
    private isSavingRemote = false;
    private isLoadingRemote = false;
    private isLoadingRoster = false;
    private readonly pollIntervalMs = 30_000;
    private readonly visibilityChangeHandler = () => {
        if (!document.hidden && !this.editing) {
            this.loadSharedState(false);
        }
    };

    private readonly repeaterLat = 38.333667;
    private readonly repeaterLng = -90.537611;

    private readonly locationCoordinates: Record<string, { lat: number; lng: number }> = {
        'AFFTON': { lat: 38.5506, lng: -90.3332 },
        'ANTONIA': { lat: 38.2867, lng: -90.3918 },
        'ARNOLD': { lat: 38.4328, lng: -90.3776 },
        'BALLWIN': { lat: 38.5951, lng: -90.5462 },
        'BARNHART': { lat: 38.3448, lng: -90.3935 },
        'BEAUFORT': { lat: 38.4317, lng: -91.1993 },
        'BEACH': { lat: 38.2634, lng: -90.5785 },
        'BELLEFONTAINE NEIGHBORS': { lat: 38.7403, lng: -90.2268 },
        'BEL NOR': { lat: 38.7023, lng: -90.3168 },
        'BEL RIDGE': { lat: 38.7095, lng: -90.3285 },
        'BELLERIVE': { lat: 38.7087, lng: -90.3137 },
        'BERKELEY': { lat: 38.7545, lng: -90.3312 },
        'BLACK JACK': { lat: 38.7931, lng: -90.2673 },
        'BLACKWELL': { lat: 38.0495, lng: -90.6376 },
        'BLOOMSDALE': { lat: 38.0128, lng: -90.2179 },
        'BONNE TERRE': { lat: 37.9231, lng: -90.5557 },
        'BOURBON': { lat: 38.1548, lng: -91.2449 },
        'BRECKENRIDGE HILLS': { lat: 38.7145, lng: -90.3671 },
        'BRENTWOOD': { lat: 38.6176, lng: -90.3493 },
        'BRIDGETON': { lat: 38.7667, lng: -90.4115 },
        'BYRNESVILLE': { lat: 38.2606, lng: -90.6451 },
        'CADET': { lat: 38.0089, lng: -90.6893 },
        'CALEDONIA': { lat: 37.7634, lng: -90.7721 },
        'CALVERTON PARK': { lat: 38.7648, lng: -90.3134 },
        'CATAWISSA': { lat: 38.4178, lng: -90.7785 },
        'CEDAR HILL': { lat: 38.3539, lng: -90.6418 },
        'CHAIN OF ROCKS': { lat: 38.7601, lng: -90.1748 },
        'CHARLACK': { lat: 38.7020, lng: -90.3437 },
        'CHESTERFIELD': { lat: 38.6631, lng: -90.5771 },
        'CLARKSON VALLEY': { lat: 38.6187, lng: -90.5898 },
        'CLAYTON': { lat: 38.6426, lng: -90.3237 },
        'COLUMBIA': { lat: 38.9517, lng: -92.3341 },
        'COOL VALLEY': { lat: 38.7273, lng: -90.3107 },
        'COUNTRY CLUB HILLS': { lat: 38.7209, lng: -90.2737 },
        'COUNTRY LIFE ACRES': { lat: 38.6237, lng: -90.4568 },
        'CRESTWOOD': { lat: 38.5570, lng: -90.3818 },
        'CREVE COEUR': { lat: 38.6609, lng: -90.4226 },
        'CRYSTAL CITY': { lat: 38.2217, lng: -90.3790 },
        'DE SOTO': { lat: 38.1395, lng: -90.5551 },
        'DES PERES': { lat: 38.6009, lng: -90.4329 },
        'DESLOGE': { lat: 37.8709, lng: -90.5276 },
        'DESOTO': { lat: 38.1395, lng: -90.5551 },
        'DITTMER': { lat: 38.3370, lng: -90.6801 },
        'DOE RUN': { lat: 37.7423, lng: -90.4985 },
        'ELLINGTON': { lat: 37.2367, lng: -90.9733 },
        'ELLISVILLE': { lat: 38.5926, lng: -90.5871 },
        'EUREKA': { lat: 38.5026, lng: -90.6279 },
        'FARMINGTON': { lat: 37.7809, lng: -90.4218 },
        'FENTON': { lat: 38.5131, lng: -90.4359 },
        'FERGUSON': { lat: 38.7442, lng: -90.3054 },
        'FESTUS': { lat: 38.2206, lng: -90.3959 },
        'FLORDELL HILLS': { lat: 38.7145, lng: -90.2615 },
        'FLORISSANT': { lat: 38.7892, lng: -90.3226 },
        'FRANKLIN COUNTY': { lat: 38.4215, lng: -91.0751 },
        'FRENCH VILLAGE': { lat: 37.9845, lng: -90.3893 },
        'FRONTENAC': { lat: 38.6356, lng: -90.4151 },
        'GERALD': { lat: 38.4003, lng: -91.3307 },
        'GLENDALE': { lat: 38.5959, lng: -90.3771 },
        'GOODFELLOW TERRACE': { lat: 38.7059, lng: -90.2537 },
        'GRANTWOOD VILLAGE': { lat: 38.5564, lng: -90.3496 },
        'GRAY SUMMIT': { lat: 38.4898, lng: -90.8168 },
        'GREEN PARK': { lat: 38.5237, lng: -90.3385 },
        'GROVER': { lat: 38.5745, lng: -90.6426 },
        'GRUBVILLE': { lat: 38.2637, lng: -90.7685 },
        'HANLEY HILLS': { lat: 38.6856, lng: -90.3237 },
        'HARRISONVILLE': { lat: 38.6564, lng: -90.1695 },
        'HAZELWOOD': { lat: 38.7714, lng: -90.3709 },
        'HERCULANEUM': { lat: 38.2684, lng: -90.3801 },
        'HIGH RIDGE': { lat: 38.4589, lng: -90.5368 },
        'HILLSBORO': { lat: 38.2323, lng: -90.5629 },
        'HILLSDALE': { lat: 38.6837, lng: -90.2848 },
        'HOUSE SPRINGS': { lat: 38.4084, lng: -90.5651 },
        'HUNTLEIGH': { lat: 38.6167, lng: -90.4090 },
        'IMPERIAL': { lat: 38.3698, lng: -90.3782 },
        'IRONDALE': { lat: 37.8350, lng: -90.6726 },
        'IRON MOUNTAIN LAKE': { lat: 37.6917, lng: -90.6210 },
        'JENNINGS': { lat: 38.7192, lng: -90.2604 },
        'KIMMSWICK': { lat: 38.3659, lng: -90.3626 },
        'KINLOCH': { lat: 38.7387, lng: -90.3229 },
        'KIRKWOOD': { lat: 38.5834, lng: -90.4068 },
        'LADUE': { lat: 38.6498, lng: -90.3807 },
        'LABADIE': { lat: 38.5306, lng: -90.8501 },
        'LAKE SAINT LOUIS': { lat: 38.7976, lng: -90.7857 },
        'LAKE ST LOUIS': { lat: 38.7976, lng: -90.7857 },
        'LEADWOOD': { lat: 37.8673, lng: -90.5935 },
        'LEMAY': { lat: 38.5334, lng: -90.2793 },
        'LIGUORI': { lat: 38.3410, lng: -90.4176 },
        'LIGOURI': { lat: 38.3410, lng: -90.4176 },
        'LONEDELL': { lat: 38.2695, lng: -90.8635 },
        'MACKENZIE': { lat: 38.5795, lng: -90.3182 },
        'MAPLEWOOD': { lat: 38.6126, lng: -90.3246 },
        'MARLBOROUGH': { lat: 38.5706, lng: -90.3385 },
        'MARYLAND HEIGHTS': { lat: 38.7131, lng: -90.4298 },
        'MANCHESTER': { lat: 38.5970, lng: -90.5093 },
        'MEHLVILLE': { lat: 38.5084, lng: -90.3229 },
        'MINERAL POINT': { lat: 37.9434, lng: -90.7276 },
        'MURPHY': { lat: 38.4903, lng: -90.4873 },
        'NORMANDY': { lat: 38.7209, lng: -90.2979 },
        'NORTHWOODS': { lat: 38.7045, lng: -90.2837 },
        'NORWOOD COURT': { lat: 38.7112, lng: -90.2873 },
        'OAKLAND': { lat: 38.5764, lng: -90.3851 },
        'OAKVILLE': { lat: 38.4701, lng: -90.3046 },
        'OLD MINES': { lat: 38.0409, lng: -90.7490 },
        'OLIVETTE': { lat: 38.6653, lng: -90.3759 },
        'OVERLAND': { lat: 38.7012, lng: -90.3623 },
        'PACIFIC': { lat: 38.4820, lng: -90.7415 },
        'PAGEDALE': { lat: 38.6834, lng: -90.3076 },
        'PARK HILLS': { lat: 37.8542, lng: -90.5182 },
        'PARKDALE': { lat: 38.4762, lng: -90.5318 },
        'PARKWAY': { lat: 38.3345, lng: -90.4035 },
        'PEVELY': { lat: 38.2834, lng: -90.3951 },
        'PINE LAWN': { lat: 38.6959, lng: -90.2759 },
        'POTOSI': { lat: 37.9364, lng: -90.7879 },
        'RICHMOND HEIGHTS': { lat: 38.6287, lng: -90.3196 },
        'RICHWOODS': { lat: 38.1578, lng: -90.8282 },
        'RIVERVIEW': { lat: 38.7473, lng: -90.2112 },
        'ROBERTSVILLE': { lat: 38.4148, lng: -90.8168 },
        'ROCK HILL': { lat: 38.6076, lng: -90.3785 },
        'SALEM': { lat: 37.6456, lng: -91.5359 },
        'SAPPINGTON': { lat: 38.5367, lng: -90.3796 },
        'SHREWSBURY': { lat: 38.5903, lng: -90.3368 },
        'ST. ANN': { lat: 38.7273, lng: -90.3832 },
        'ST ANN': { lat: 38.7273, lng: -90.3832 },
        'SAINT ANN': { lat: 38.7273, lng: -90.3832 },
        'ST. CHARLES': { lat: 38.7881, lng: -90.4974 },
        'ST CHARLES': { lat: 38.7881, lng: -90.4974 },
        'SAINT CHARLES': { lat: 38.7881, lng: -90.4974 },
        'ST. CLAIR': { lat: 38.3459, lng: -90.9807 },
        'ST CLAIR': { lat: 38.3459, lng: -90.9807 },
        'SAINT CLAIR': { lat: 38.3459, lng: -90.9807 },
        'ST. FRANCOIS COUNTY': { lat: 37.8107, lng: -90.4724 },
        'ST FRANCOIS COUNTY': { lat: 37.8107, lng: -90.4724 },
        'SAINT FRANCOIS COUNTY': { lat: 37.8107, lng: -90.4724 },
        'ST. GEORGE': { lat: 38.5367, lng: -90.3148 },
        'ST GEORGE': { lat: 38.5367, lng: -90.3148 },
        'SAINT GEORGE': { lat: 38.5367, lng: -90.3148 },
        'ST. JOHN': { lat: 38.7134, lng: -90.3434 },
        'ST JOHN': { lat: 38.7134, lng: -90.3434 },
        'SAINT JOHN': { lat: 38.7134, lng: -90.3434 },
        'ST. LOUIS': { lat: 38.6270, lng: -90.1994 },
        'ST LOUIS': { lat: 38.6270, lng: -90.1994 },
        'SAINT LOUIS': { lat: 38.6270, lng: -90.1994 },
        'ST. PETERS': { lat: 38.7875, lng: -90.6299 },
        'ST PETERS': { lat: 38.7875, lng: -90.6299 },
        'SAINT PETERS': { lat: 38.7875, lng: -90.6299 },
        'STE. GENEVIEVE': { lat: 37.9814, lng: -90.0418 },
        'STE GENEVIEVE': { lat: 37.9814, lng: -90.0418 },
        'SAINTE GENEVIEVE': { lat: 37.9814, lng: -90.0418 },
        'STEELEVILLE': { lat: 37.9681, lng: -91.3540 },
        'SULLIVAN': { lat: 38.2081, lng: -91.1604 },
        'SUNSET HILLS': { lat: 38.5389, lng: -90.4073 },
        'TOWN AND COUNTRY': { lat: 38.6123, lng: -90.4635 },
        'TROY': { lat: 38.9795, lng: -90.9807 },
        'UNION': { lat: 38.4501, lng: -91.0085 },
        'UNIVERSITY CITY': { lat: 38.6559, lng: -90.3093 },
        'UPLANDS PARK': { lat: 38.6953, lng: -90.2837 },
        'VALLEY PARK': { lat: 38.5492, lng: -90.4926 },
        'VELDA CITY': { lat: 38.6906, lng: -90.2943 },
        'VELDA VILLAGE HILLS': { lat: 38.6959, lng: -90.2879 },
        'VILLA RIDGE': { lat: 38.4720, lng: -90.8868 },
        'VINITA PARK': { lat: 38.6909, lng: -90.3423 },
        'WARE': { lat: 38.2137, lng: -90.6751 },
        'WARRENTON': { lat: 38.8114, lng: -91.1410 },
        'WASHINGTON': { lat: 38.5581, lng: -91.0121 },
        'WEBSTER GROVES': { lat: 38.5926, lng: -90.3573 },
        'WELLSTON': { lat: 38.6726, lng: -90.2990 },
        'WENTZVILLE': { lat: 38.8114, lng: -90.8529 },
        'WILDWOOD': { lat: 38.5828, lng: -90.6629 },
        'WINCHESTER': { lat: 38.5906, lng: -90.5276 },
        'WOODSON TERRACE': { lat: 38.7259, lng: -90.3585 },

        // Missouri ambiguous defaults
        'OFALLON IL': { lat: 38.8106, lng: -90.6998 },
        'O FALLON IL': { lat: 38.8106, lng: -90.6998 },
        "O'FALLON IL": { lat: 38.8106, lng: -90.6998 },
        'TROY IL': { lat: 38.9795, lng: -90.9807 },
        'COLUMBIA IL': { lat: 38.9517, lng: -92.3341 },

        // Illinois - append IL in the location field
// Illinois - wider Metro East / southwest IL / check-in range
        'ALBERS': { lat: 38.5431, lng: -89.6129 },
        'ALHAMBRA': { lat: 38.8887, lng: -89.7312 },
        'AVISTON': { lat: 38.6067, lng: -89.6079 },
        'BARTELSO': { lat: 38.5367, lng: -89.4665 },
        'BECKEMEYER': { lat: 38.6056, lng: -89.4359 },
        'BETHALTO': { lat: 38.9092, lng: -90.0407 },
        'BREESE': { lat: 38.6106, lng: -89.5270 },
        'BRIGHTON': { lat: 39.0398, lng: -90.1407 },
        'BUNKERLL IL': { lat: 39.0428, lng: -89.9518 },
        'CARLINVILLE': { lat: 39.2798, lng: -89.8818 },
        'CARLYLE': { lat: 38.6103, lng: -89.3726 },
        'CENTRALIA': { lat: 38.5250, lng: -89.1334 },
        'COLLINSVILLE': { lat: 38.6760, lng: -90.0035 },
        'COULTERVILLE': { lat: 38.1862, lng: -89.6048 },
        'DAMIANSVILLE': { lat: 38.5084, lng: -89.6220 },
        'EAST CRONDELET IL': { lat: 38.5387, lng: -90.2318 },
        'FREEBURG': { lat: 38.4273, lng: -89.9134 },
        'GILLESPIE': { lat: 39.1298, lng: -89.8198 },
        'GIRARD': { lat: 39.4464, lng: -89.7809 },
        'GODFREY': { lat: 38.9556, lng: -90.1868 },
        'GREENVILLE': { lat: 38.8923, lng: -89.4131 },
        'HAMEL': { lat: 38.8881, lng: -89.8418 },
        'HIGHLAND': { lat: 38.7395, lng: -89.6712 },
        'JERSEYVILLE': { lat: 39.1200, lng: -90.3285 },
        'LEBANON': { lat: 38.6039, lng: -89.8073 },
        'LITCHFIELD': { lat: 39.1753, lng: -89.6543 },
        'LIVINGSTON': { lat: 38.9673, lng: -89.7634 },
        'MARINE': { lat: 38.7867, lng: -89.7776 },
        'MARISSA': { lat: 38.2501, lng: -89.7509 },
        'MOUNTIVE IL': { lat: 39.0720, lng: -89.7279 },
        'MTIVE IL': { lat: 39.0720, lng: -89.7279 },
        'NEWDEN IL': { lat: 38.5350, lng: -89.7009 },
        'NEWHENS IL': { lat: 38.3264, lng: -89.8776 },
        'PONTOONACH IL': { lat: 38.7317, lng: -90.0804 },
        'REDD IL': { lat: 38.2117, lng: -89.9943 },
        'ROXANA': { lat: 38.8484, lng: -90.0762 },
        'SMITHTON': { lat: 38.4081, lng: -89.9929 },
        'SPARTA': { lat: 38.1231, lng: -89.7018 },
        'STAUNTON': { lat: 39.0123, lng: -89.7918 },
        'STEELVILLE': { lat: 37.9681, lng: -89.8648 },
        'TRENTON': { lat: 38.6056, lng: -89.6820 },
        'VENICE': { lat: 38.6723, lng: -90.1698 },
        'VIRDEN': { lat: 39.5009, lng: -89.7679 },
        'WATERLOO': { lat: 38.3345, lng: -90.1517 },
    };

    private readonly ambiguousLocationNames = new Set([
        'OFALLON',
        "O'FALLON",
        'O FALLON',
        'TROY',
        'COLUMBIA',
    ]);

    openingScript = this.defaultOpeningScript;
    trafficPrompt = this.defaultTrafficPrompt;
    lateCheckinPrompt = this.defaultLateCheckinPrompt;
    closingScript = this.defaultClosingScript;

    stations: Station[] = [];
    queue: Station[] = [];
    logEntries: LogEntry[] = [];
    clubMembers: ClubMember[] = [];
    rosterSearchCallsign = '';
    backendOnline = false;
    editing = false;
    pendingClearCurrentSession = false;
    isClearingCurrentSession = false;
    pendingRemoveRosterMemberId = '';
    removingRosterMemberId = '';

    savedSessions: SavedNetControlSession[] = [];
    selectedSavedSessionId = '';
    savedSessionName = this.buildDefaultSessionName();

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        const storedScriptVersion = localStorage.getItem(this.scriptVersionKey);

        if (storedScriptVersion !== this.currentScriptVersion) {
            this.resetScriptsToCurrentDefaults();
            localStorage.setItem(this.scriptVersionKey, this.currentScriptVersion);
        }

        this.refreshRosterMembers();
        this.loadSharedState(true);
        document.addEventListener('visibilitychange', this.visibilityChangeHandler);
        this.pollSubscription = interval(this.pollIntervalMs).subscribe(() => {
            if (this.editing || document.hidden) return;

            this.loadSharedState(false);
        });
    }

    ngOnDestroy(): void {
        this.pollSubscription?.unsubscribe();
        document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    get checkedInCallsigns(): Set<string> {
        return new Set(this.stations.map((station) => station.callsign).filter(Boolean));
    }

    onCallsignSearch(callsign: string): void {
        this.rosterSearchCallsign = this.normalizeCallsign(callsign);
    }

    onStationAdded(station: Station): void {
        let normalizedStation = this.normalizeStation({
            ...station,
            status: station.trafficType === 'shortTime' ? 'complete' : station.status,
        });

        const rosterMember = this.buildRosterMemberFromStation(normalizedStation);
        normalizedStation = this.normalizeStation({
            ...normalizedStation,
            memberId: rosterMember.id,
        });
        const logMessage = `${normalizedStation.callsign || normalizedStation.name} checked in as ${this.statusLabel(normalizedStation.clubStatus)} for ${this.trafficLabel(normalizedStation.trafficType)}.`;

        this.http.post<NetControlStateResponse>(
            `${environment.apiUrl}/net-control/checkins`,
            {
                ...normalizedStation,
                logMessage,
            }
        ).subscribe({
            next: (state) => {
                this.backendOnline = true;
                this.lastRemoteUpdatedAt = state.updatedAt;
                this.applySession(state.payload);
                this.refreshRosterMembers();
            },
            error: (error) => {
                this.backendOnline = false;
                console.error('Failed to add check-in', error);
            },
        });
    }

    confirmCheckIn(stationId: string): void {
        const target = this.queue.find((station) => station.id === stationId);
        if (!target) return;

        this.queue = this.queue.filter((station) => station.id !== stationId);
        this.addLog('info', `${target.callsign || target.name} confirmed in recall.`, stationId);
        this.persistState();
    }

    checkInRosterMember(request: RosterCheckInRequest): void {
        const { member, trafficType } = request;
        if (member.callsign && this.checkedInCallsigns.has(member.callsign)) return;

        this.onStationAdded({
            id: crypto.randomUUID(),
            callsign: member.callsign,
            name: member.name,
            location: member.city ?? '',
            trafficType,
            clubStatus: member.status,
            visitor: member.status === 'visitor',
            member: member.status === 'member',
            memberId: member.id,
            firstTime: member.status === 'unknown',
            notes: member.notes ?? '',
            status: 'waiting',
            checkInTime: new Date().toISOString(),
        });
    }

    updateRosterMember(member: ClubMember): void {
        const normalizedMember = this.normalizeMember(member);
        if (!normalizedMember) return;

        this.clubMembers = this.normalizeRoster(
            this.clubMembers.map((entry) => entry.id === normalizedMember.id ? normalizedMember : entry)
        );
        this.stations = this.stations.map((station) =>
            station.memberId === normalizedMember.id
                ? this.normalizeStation({
                    ...station,
                    callsign: normalizedMember.callsign,
                    name: normalizedMember.name,
                    location: normalizedMember.city ?? '',
                    clubStatus: normalizedMember.status,
                })
                : station
        );
        this.queue = this.queue.map((station) =>
            station.memberId === normalizedMember.id
                ? this.normalizeStation({
                    ...station,
                    callsign: normalizedMember.callsign,
                    name: normalizedMember.name,
                    location: normalizedMember.city ?? '',
                    clubStatus: normalizedMember.status,
                })
                : station
        );

        this.saveRosterMember(normalizedMember, () => {
            if (!this.editing) {
                this.refreshRosterMembers();
            }
            this.persistState();
        });
    }

    removeRosterMember(member: ClubMember): void {
        if (this.removingRosterMemberId) return;

        if (this.pendingRemoveRosterMemberId !== member.id) {
            this.pendingRemoveRosterMemberId = member.id;
            return;
        }

        this.deleteRosterMember(member);
    }

    toggleRosterEditing(): void {
        this.editing = !this.editing;

        if (!this.editing) {
            this.pendingClearCurrentSession = false;
            this.pendingRemoveRosterMemberId = '';
            this.refreshRosterMembers();
        }
    }

    setActiveStation(stationId: string): void {
        const target = this.stations.find((station) => station.id === stationId);
        if (!target) return;

        this.stations = this.stations.map((station) => {
            if (station.id === stationId) {
                return { ...station, status: 'active' };
            }

            if (station.status === 'active') {
                return { ...station, status: 'waiting' };
            }

            return station;
        });

        this.queue = this.queue.filter((station) => station.id !== stationId);

        this.addLog('info', `Recognized ${target.callsign || target.name}.`, stationId);
        this.persistState();
    }

    markStationComplete(stationId: string): void {
        const target = this.stations.find((station) => station.id === stationId);
        if (!target) return;

        this.stations = this.stations.map((station) =>
            station.id === stationId
                ? { ...station, status: 'complete' }
                : station
        );

        this.queue = this.queue.filter((station) => station.id !== stationId);

        this.addLog('info', `${target.callsign || target.name} marked complete.`, stationId);
        this.persistState();
    }

    updateStation(station: Station): void {
        const normalizedStation = this.normalizeStation(station);
        const current = this.stations.find((entry) => entry.id === normalizedStation.id);

        this.stations = this.stations.map((entry) =>
            entry.id === normalizedStation.id ? normalizedStation : entry
        );
        this.queue = this.queue.map((entry) =>
            entry.id === normalizedStation.id ? normalizedStation : entry
        );

        if (current && current.trafficType !== normalizedStation.trafficType) {
            this.addLog(
                'info',
                `${normalizedStation.callsign || normalizedStation.name} changed to ${this.trafficLabel(normalizedStation.trafficType)}.`,
                normalizedStation.id
            );
        }

        this.persistState();
    }

    saveCurrentSession(): void {
        const savedAt = new Date().toISOString();
        const name = this.savedSessionName.trim() || this.buildDefaultSessionName();
        const session: SavedNetControlSession = {
            ...this.buildSessionSnapshot(),
            id: crypto.randomUUID(),
            name,
            savedAt,
        };

        const updated = [session, ...this.savedSessions];

        this.savedSessions = updated;
        this.selectedSavedSessionId = session.id;
        this.savedSessionName = this.buildDefaultSessionName();

        this.clearCurrentSessionAfterSave();
    }

    private clearCurrentSessionAfterSave(): void {
        this.stations = [];
        this.queue = [];
        this.logEntries = [];
        this.rosterSearchCallsign = '';

        this.persistState();
    }

    loadSelectedSession(): void {
        if (!this.selectedSavedSessionId) return;

        const target = this.savedSessions.find(
            (session) => session.id === this.selectedSavedSessionId
        );

        if (!target) return;

        this.applySession(target);
        this.persistState();
    }

    deleteSelectedSession(): void {
        if (!this.selectedSavedSessionId) return;

        const updated = this.savedSessions.filter(
            (session) => session.id !== this.selectedSavedSessionId
        );

        this.savedSessions = updated;
        this.selectedSavedSessionId = '';

        this.persistState();
    }

    exportCurrentSession(): void {
        const snapshot: SavedNetControlSession = {
            ...this.buildSessionSnapshot(),
            id: crypto.randomUUID(),
            name: `Net Export ${new Date().toLocaleString()}`,
            savedAt: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
            type: 'application/json',
        });

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        anchor.href = url;
        anchor.download = `net-control-${timestamp}.json`;
        anchor.click();

        URL.revokeObjectURL(url);
    }

    async importSession(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as SavedNetControlSession;

            if (
                !parsed ||
                !Array.isArray(parsed.stations) ||
                !Array.isArray(parsed.queue) ||
                !Array.isArray(parsed.logEntries)
            ) {
                throw new Error('Invalid net control session file.');
            }

            this.applySession(parsed);
            this.persistState();
        } catch (error) {
            console.error(error);
            window.alert('Could not import that file.');
        } finally {
            input.value = '';
        }
    }

    clearCurrentSession(): void {
        if (this.isClearingCurrentSession) return;

        if (!this.pendingClearCurrentSession) {
            this.pendingClearCurrentSession = true;
            return;
        }

        const previousSession = this.buildSessionSnapshot();

        this.isClearingCurrentSession = true;
        this.stations = [];
        this.queue = [];
        this.logEntries = [];
        this.rosterSearchCallsign = '';

        this.saveSharedState(
            () => {
                this.pendingClearCurrentSession = false;
                this.isClearingCurrentSession = false;
            },
            () => {
                this.applySession(previousSession);
                this.pendingClearCurrentSession = false;
                this.isClearingCurrentSession = false;
            }
        );
    }

    private addLog(
        type: LogEntry['type'],
        message: string,
        stationId?: string
    ): void {
        const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type,
            message,
            stationId,
        };

        this.logEntries = [entry, ...this.logEntries];
    }

    private buildSessionSnapshot(): NetControlSharedPayload {
        return {
            openingScript: this.openingScript,
            trafficPrompt: this.trafficPrompt,
            lateCheckinPrompt: this.lateCheckinPrompt,
            closingScript: this.closingScript,
            stations: this.stations,
            queue: this.queue,
            logEntries: this.logEntries,
            savedSessions: this.savedSessions,
        };
    }

    private buildDefaultSessionName(): string {
        return `Net ${new Date().toLocaleString()}`;
    }

    private applySession(session: Partial<NetControlSharedPayload>): void {
        this.openingScript = session.openingScript ?? this.openingScript;
        this.trafficPrompt = session.trafficPrompt ?? this.trafficPrompt;
        this.lateCheckinPrompt = session.lateCheckinPrompt ?? this.lateCheckinPrompt;
        this.closingScript = session.closingScript ?? this.closingScript;
        this.stations = (session.stations ?? []).map((station) => this.normalizeStation(station));
        this.queue = (session.queue ?? []).map((station) => this.normalizeStation(station));
        this.logEntries = session.logEntries ?? [];

        if (Array.isArray(session.savedSessions)) {
            this.savedSessions = session.savedSessions;
        }
    }

    private loadSharedState(initialLoad: boolean): void {
        if (this.isLoadingRemote) return;

        this.isLoadingRemote = true;
        const updatedAfter = this.lastRemoteUpdatedAt
            ? `?updated_after=${encodeURIComponent(this.lastRemoteUpdatedAt)}`
            : '';

        this.http.get<NetControlStateResponse | null>(
            `${environment.apiUrl}/net-control/session${updatedAfter}`
        ).pipe(
            finalize(() => this.isLoadingRemote = false)
        ).subscribe({
            next: (state) => {
                this.backendOnline = true;

                // The API returns 204 when the session has not changed.
                if (!state) return;

                if (!state.payload || Object.keys(state.payload).length === 0) {
                    if (initialLoad) {
                        this.saveSharedState();
                    }
                    return;
                }

                if (this.isSavingRemote || state.updatedAt === this.lastRemoteUpdatedAt) {
                    return;
                }

                this.lastRemoteUpdatedAt = state.updatedAt;

                const storedScriptVersion = localStorage.getItem(this.scriptVersionKey);

                if (storedScriptVersion === this.currentScriptVersion) {
                    this.applySession({
                        ...state.payload,
                        openingScript: this.openingScript,
                        trafficPrompt: this.trafficPrompt,
                        lateCheckinPrompt: this.lateCheckinPrompt,
                        closingScript: this.closingScript,
                    });
                    return;
                }

                this.applySession(state.payload);
            },
            error: (error) => {
                this.backendOnline = false;
                if (initialLoad) {
                    console.error('Failed to load shared net control state', error);
                }
            },
        });
    }

    private saveSharedState(afterSave?: () => void, afterError?: () => void): void {
        this.isSavingRemote = true;
        this.http.put<NetControlStateResponse>(
            `${environment.apiUrl}/net-control/session`,
            { payload: this.buildSessionSnapshot() }
        ).subscribe({
            next: (state) => {
                this.backendOnline = true;
                this.lastRemoteUpdatedAt = state.updatedAt;
                this.applySession(state.payload);
                this.isSavingRemote = false;
                afterSave?.();
            },
            error: (error) => {
                this.backendOnline = false;
                this.isSavingRemote = false;
                console.error('Failed to save shared net control state', error);
                afterError?.();
            },
        });
    }

    private buildRosterMemberFromStation(station: Station): ClubMember {
        const existingIndex = station.callsign
            ? this.clubMembers.findIndex((entry) => entry.callsign === station.callsign)
            : -1;
        const existing = existingIndex >= 0 ? this.clubMembers[existingIndex] : undefined;

        const city = station.location?.trim() || existing?.city || undefined;
        const coordinates = this.getCoordinatesForLocation(city);

        const member: ClubMember = {
            id: existing?.id ?? station.memberId ?? `manual-${station.callsign || crypto.randomUUID()}`.toLowerCase(),
            callsign: station.callsign,
            name: station.name?.trim() || existing?.name || station.callsign,
            city,
            notes: station.notes?.trim() || existing?.notes || undefined,
            status: station.clubStatus,
            source: existing?.source ?? 'manual',
            lat: coordinates?.lat,
            lng: coordinates?.lng,
            distanceMiles: coordinates
                ? this.distanceMilesFromRepeater(coordinates.lat, coordinates.lng)
                : undefined,
        };

        return member;
    }

    private saveRosterMember(member: ClubMember, afterSave?: () => void): void {
        this.http.put<ClubMember>(
            `${environment.apiUrl}/net-control/roster-members/${encodeURIComponent(member.id)}`,
            member
        ).subscribe({
            next: () => {
                afterSave?.();
            },
            error: (error) => {
                console.error('Failed to save roster member', error);
            },
        });
    }

    private deleteRosterMember(member: ClubMember): void {
        this.removingRosterMemberId = member.id;
        this.http.delete<NetControlStateResponse>(
            `${environment.apiUrl}/net-control/roster-members/${encodeURIComponent(member.id)}`
        ).subscribe({
            next: (state) => {
                this.backendOnline = true;
                this.lastRemoteUpdatedAt = state.updatedAt;
                this.applySession(state.payload);
                this.refreshRosterMembers();
                this.pendingRemoveRosterMemberId = '';
                this.removingRosterMemberId = '';
            },
            error: (error) => {
                console.error('Failed to delete roster member', error);
                this.pendingRemoveRosterMemberId = '';
                this.removingRosterMemberId = '';
            },
        });
    }

    private refreshRosterMembers(): void {
        if (this.editing || this.isLoadingRoster) return;

        this.isLoadingRoster = true;
        this.http.get<ClubMember[]>(
            `${environment.apiUrl}/net-control/roster-members`
        ).pipe(
            finalize(() => this.isLoadingRoster = false)
        ).subscribe({
            next: (members) => {
                this.clubMembers = this.normalizeRoster(members);
            },
            error: (error) => {
                console.error('Failed to load roster members', error);
            },
        });
    }

    private normalizeStation(station: Station): Station {
        const callsign = this.normalizeCallsign(station.callsign);
        const member = this.clubMembers.find(
            (entry) => entry.id === station.memberId || entry.callsign === callsign
        );
        const trafficType = this.normalizeTrafficType(station.trafficType);
        const clubStatus = this.normalizeStatus(
            station.clubStatus ??
            member?.status ??
            (station.member ? 'member' : station.firstTime ? 'unknown' : 'visitor')
        );

        const location = station.location?.trim() || member?.city || '';
        const coordinates = this.getCoordinatesForLocation(location);
        const distance = coordinates
            ? this.distanceMilesFromRepeater(coordinates.lat, coordinates.lng)
            : member?.distanceMiles;

        return {
            ...station,
            callsign,
            name: station.name?.trim() || member?.name || '',
            location,
            distance,
            trafficType,
            clubStatus,
            member: clubStatus === 'member',
            memberId: member?.id ?? station.memberId,
            visitor: clubStatus === 'visitor',
            firstTime: clubStatus === 'unknown',
            status: trafficType === 'shortTime' ? 'complete' : station.status,
        };
    }

    private normalizeRoster(roster: ClubMember[] | undefined): ClubMember[] {
        const incoming = Array.isArray(roster) ? roster : [];
        const normalized = incoming
            .map((member) => this.normalizeMember(member))
            .filter((member): member is ClubMember => !!member);

        return normalized;
    }

    private normalizeMember(value: unknown): ClubMember | null {
        if (!value || typeof value !== 'object') {
            return null;
        }

        const member = value as Partial<ClubMember> & { location?: string };
        const callsign = this.normalizeCallsign(member.callsign ?? '');
        const name = member.name?.trim() || callsign;

        if (!name) {
            return null;
        }

        const city = member.city?.trim() || member.location?.trim() || undefined;
        const coordinates = this.getCoordinatesForLocation(city);

        return {
            id: member.id ?? `manual-${callsign || crypto.randomUUID()}`.toLowerCase(),
            callsign,
            name,
            city,
            notes: member.notes?.trim() || undefined,
            status: this.normalizeStatus(member.status),
            source: member.source ?? 'manual',
            lat: coordinates?.lat,
            lng: coordinates?.lng,
            distanceMiles: coordinates
                ? this.distanceMilesFromRepeater(coordinates.lat, coordinates.lng)
                : undefined,
        };
    }

    private normalizeStatus(value: unknown): ClubStatus {
        if (value === 'firstTime') {
            return 'unknown';
        }

        return value === 'member' || value === 'unknown' || value === 'visitor'
            ? value
            : 'visitor';
    }

    private normalizeTrafficType(value: unknown): Station['trafficType'] {
        return value === 'shortTime' ? 'shortTime' : 'regular';
    }

    private statusLabel(status: ClubStatus): string {
        switch (status) {
            case 'member':
                return 'member';
            case 'unknown':
                return 'unknown';
            default:
                return 'visitor';
        }
    }

    private trafficLabel(trafficType: Station['trafficType']): string {
        return trafficType === 'shortTime' ? 'short time' : 'regular';
    }

    private normalizeCallsign(value: string): string {
        return value.trim().toUpperCase().replace(/Ø/g, '0');
    }

    private resetScriptsToCurrentDefaults(): void {
        this.openingScript = this.defaultOpeningScript;
        this.trafficPrompt = this.defaultTrafficPrompt;
        this.lateCheckinPrompt = this.defaultLateCheckinPrompt;
        this.closingScript = this.defaultClosingScript;
    }

    private persistState(): void {
        this.saveSharedState();
    }

    private normalizeLocationKey(value: string | undefined): string {
        return (value ?? '')
            .trim()
            .toUpperCase()
            .replace(/,\s*/g, ' ')
            .replace(/\s+/g, ' ');
    }

    private getCoordinatesForLocation(location: string | undefined): { lat: number; lng: number } | undefined {
        const normalized = this.normalizeLocationKey(location);

        if (!normalized) return undefined;

        return this.locationCoordinates[normalized];
    }

    private isAmbiguousLocation(location: string | undefined): boolean {
        const normalized = this.normalizeLocationKey(location)
            .replace(/[']/g, '')
            .replace(/\s+/g, ' ');

        return this.ambiguousLocationNames.has(normalized);
    }

    private distanceMilesFromRepeater(lat: number, lng: number): number {
        const earthRadiusMiles = 3958.8;
        const toRadians = (degrees: number) => degrees * Math.PI / 180;

        const dLat = toRadians(lat - this.repeaterLat);
        const dLng = toRadians(lng - this.repeaterLng);
        const lat1 = toRadians(this.repeaterLat);
        const lat2 = toRadians(lat);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng / 2) ** 2;

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return Math.round(earthRadiusMiles * c * 10) / 10;
    }
}
