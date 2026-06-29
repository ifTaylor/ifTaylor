import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { environment } from '../../../environments/environment';

type PracticeMode = 'letters' | 'numbers' | 'mixed' | 'callsigns' | 'qsoWords' | 'qso';
type TrainingGoal = 'learn' | 'speed' | 'accuracy' | 'weaknesses' | 'qso';
type ExerciseFormat = 'groups' | 'continuous' | 'instant' | 'guidedQso' | 'simulatedQso';
type SessionPreset = 'warmup' | 'weaknesses' | 'callsigns' | 'firstQso' | 'onAir';
type WorkspaceView = 'practice' | 'progress';
type ToastTone = 'success' | 'info' | 'error';
type SettingsSection = 'advanced' | 'content' | 'speed' | 'audio' | 'timing' | 'scoring';
type SettingsSectionState = Record<SettingsSection, boolean>;
type QsoStage = 'mixed' | 'frequency' | 'cq' | 'answer' | 'p1' | 'p2' | 'p3' | 'recovery' | 'closing' | 'complete';
type WordCategory = 'all' | 'core' | 'prosigns' | 'qsignals' | 'abbreviations' | 'recovery' | 'ragchew';
type AudioEffect = 'clean' | 'light' | 'challenging';
type MarkStatus = 'correct' | 'incorrect' | 'missing' | 'extra';
type LetterDrill = 'random' | 'koch' | 'trouble' | 'confusions' | 'combinations' | 'vowels' | 'consonants' | 'custom';
type NumberDrill = 'random' | 'dates' | 'times' | 'frequencies' | 'rst' | 'serials' | 'coordinates';
type MixedDrill = 'random' | 'radio' | 'confusions' | 'custom';
type RevealMode = 'check' | 'afterPlayback' | 'groups';

interface CharacterMark {
    character: string;
    status: MarkStatus;
}

interface CopyResult {
    expected: string;
    copied: string;
    accuracy: number;
    correct: boolean;
    mode: string;
    detail: string;
    wpm: number;
    farnsworthWpm: number;
    effectiveCopyWpm: number;
}

interface StationProfile {
    call: string;
    name: string;
    qth: string;
    rig: string;
    antenna: string;
    power: string;
}

interface CwOperatorProfile {
    callsign: string;
    name: string;
    qth: string;
    rig: string;
    antenna: string;
    power: string;
    settings?: Partial<CwUiState>;
    createdAt?: string;
    updatedAt?: string;
}

interface CwUiState {
    uiStateVersion: number;
    activeWorkspace: WorkspaceView;
    showAllMetricConditions: boolean;
    trainingGoal: TrainingGoal;
    mode: PracticeMode;
    exerciseFormat: ExerciseFormat;
    activePreset: SessionPreset | null;
    wpm: number;
    farnsworthWpm: number;
    audioEffect: AudioEffect;
    groupSize: number;
    groupCount: number;
    sessionTargetAttempts: number;
    tone: number;
    repeatCount: number;
    countdownSeconds: number;
    timedMinutes: number;
    strictSpacing: boolean;
    adaptiveCharacters: boolean;
    adaptiveSpeed: boolean;
    revealMode: RevealMode;
    letterDrill: LetterDrill;
    numberDrill: NumberDrill;
    mixedDrill: MixedDrill;
    qsoStage: QsoStage;
    wordCategory: WordCategory;
    settingsSections: SettingsSectionState;
}

interface ToneEvent {
    start: number;
    duration: number;
}

interface GeneratedExercise {
    text: string;
    context: string;
}

interface QsoDefinition {
    token: string;
    meaning: string;
    kind: 'Prosign' | 'Q signal' | 'Abbreviation' | 'Operating term';
}

interface CwPracticeAttempt {
    id?: string;
    operator: string;
    mode: PracticeMode;
    drill: string;
    accuracy: number;
    correctCharacters: number;
    totalCharacters: number;
    wpm: number;
    farnsworthWpm: number;
    durationSeconds: number;
    missedCharacters: Record<string, number>;
    characterScores: Record<string, number>;
    confusions: Record<string, number>;
    trainingGoal?: TrainingGoal | null;
    exerciseFormat?: ExerciseFormat | null;
    audioEffect?: AudioEffect | null;
    repeatCount?: number | null;
    groupSize?: number | null;
    strictSpacing?: boolean | null;
    timedMinutes?: number | null;
    playCount?: number | null;
    revealedBeforeCheck?: boolean | null;
    sessionId?: string | null;
    characterAttempts?: Record<string, number> | null;
    characterCorrect?: Record<string, number> | null;
    missingCount?: number | null;
    incorrectCount?: number | null;
    extraCount?: number | null;
    createdAt?: string;
}

interface CwPerformanceOverview {
    attempts: number;
    characters: number;
    weightedAccuracy: number;
    masteryAccuracy: number;
    confidenceLow: number;
    confidenceHigh: number;
    effectiveWpm: number;
    consistency: 'High' | 'Moderate' | 'Variable';
    consistencySpread: number;
    reliableSpeed: string;
    retention: string;
    retentionDelta: number | null;
    firstPlayAccuracy: number | null;
    repeatedAccuracy: number | null;
    revealRate: number | null;
    fatigueDelta: number | null;
    missingRate: number | null;
    incorrectRate: number | null;
    extraRate: number | null;
    weakestCharacters: string[];
    audioBreakdown: { label: string; accuracy: number; characters: number }[];
}

interface CwTrendTrace {
    key: string;
    label: string;
    detail: string;
    color: string;
    attempts: number;
    average: number;
    points: string;
    latest: number;
}

interface CwTrendSeries {
    mode: PracticeMode;
    label: string;
    drill: string;
    attempts: number;
    traces: CwTrendTrace[];
}

interface CwSpeedTrace {
    key: string;
    label: string;
    detail: string;
    color: string;
    attempts: number;
    points: { x: number; y: number; accuracy: number; characterWpm: number; farnsworthWpm: number }[];
    averagePoints: string;
}

interface CwSpeedSeries {
    mode: PracticeMode;
    label: string;
    drill: string;
    attempts: number;
    traces: CwSpeedTrace[];
}

interface CwProficiencySpeed {
    key: string;
    conditionLabel: string;
    characterWpm: number;
    provenFarnsworthWpm: number | null;
    candidateFarnsworthWpm: number;
    candidateAccuracy: number;
    candidateCharacters: number;
}

interface CwProficiency {
    mode: PracticeMode;
    label: string;
    drill: string;
    speeds: CwProficiencySpeed[];
}

@Component({
    standalone: true,
    imports: [CommonModule],
    templateUrl: './af0fr_cw_qso.page.html',
})
export class Af0frCwQsoPage implements OnInit, OnDestroy {
    @ViewChild('copyInput') copyInput?: ElementRef<HTMLTextAreaElement>;
    @ViewChild('mobileSetupDrawer') mobileSetupDrawer?: ElementRef<HTMLElement>;
    @ViewChild('mobileSetupTrigger') mobileSetupTrigger?: ElementRef<HTMLButtonElement>;

    mode: PracticeMode = 'letters';
    trainingGoal: TrainingGoal = 'accuracy';
    exerciseFormat: ExerciseFormat = 'groups';
    activePreset: SessionPreset | null = null;
    presetModified = false;
    activeWorkspace: WorkspaceView = 'practice';
    mobileSetupOpen = false;
    showAllMetricConditions = false;
    sessionTargetAttempts = 10;
    toastMessage = '';
    toastTone: ToastTone = 'info';
    selectedMetricPoint = '';
    settingsSections: SettingsSectionState = { advanced: false, content: true, speed: true, audio: false, timing: false, scoring: false };
    qsoStage: QsoStage = 'mixed';
    wordCategory: WordCategory = 'all';
    audioEffect: AudioEffect = 'clean';
    wpm = 17;
    farnsworthWpm = 7;
    tone = 550;
    groupSize = 5;
    groupCount = 5;
    letterDrill: LetterDrill = 'random';
    numberDrill: NumberDrill = 'random';
    mixedDrill: MixedDrill = 'random';
    mixedLetterPercent = 60;
    kochLevel = 26;
    troublePair = 'SH';
    customCharacters = 'ABCDE12345';
    adaptiveCharacters = false;
    adaptiveSpeed = false;
    instantCharacters = false;
    strictSpacing = true;
    repeatCount = 1;
    countdownSeconds = 0;
    timedMinutes = 0;
    revealMode: RevealMode = 'check';

    exercise = '';
    exerciseContext = '';
    copy = '';
    isPlaying = false;
    isPaused = false;
    hasChecked = false;
    playbackPosition = 0;
    playbackDuration = 0;
    correctCharacters = 0;
    totalCharacters = 0;
    attempts = 0;
    results: CopyResult[] = [];
    expectedMarks: CharacterMark[] = [];
    copyMarks: CharacterMark[] = [];
    weakWordCounts: Record<string, number> = {};
    profileSaved = false;
    answerRevealed = false;
    revealedGroupCount = 0;
    weakCharacterCounts: Record<string, number> = {};
    confusionCounts: Record<string, number> = {};
    metricTrends: CwTrendSeries[] = [];
    speedAccuracySeries: CwSpeedSeries[] = [];
    proficiencySummaries: CwProficiency[] = [];
    metricsLoading = false;
    metricsOnline = false;
    pendingMetricCount = 0;
    hiddenMetricTraces = new Set<string>();
    activeOperator = 'N0CALL';

    private readonly metricColors = ['#0f172a', '#f97316', '#0284c7', '#16a34a', '#9333ea', '#dc2626', '#ca8a04', '#0891b2'];

    profile: StationProfile = {
        call: 'N0CALL',
        name: '',
        qth: '',
        rig: '',
        antenna: '',
        power: '',
    };

    readonly modes: { value: PracticeMode; label: string; description: string }[] = [
        { value: 'letters', label: 'Letters', description: 'A–Z character groups' },
        { value: 'numbers', label: 'Numbers', description: '0–9 number groups' },
        { value: 'mixed', label: 'Mixed', description: 'Letters, numbers, / and ?' },
        { value: 'callsigns', label: 'Callsigns', description: 'Realistic amateur call patterns' },
        { value: 'qsoWords', label: 'QSO Words', description: 'Prosigns, Q signals, and abbreviations' },
        { value: 'qso', label: 'QSO', description: 'Guided LICW-style on-air traffic' },
    ];

    readonly trainingGoals: { value: TrainingGoal; label: string; description: string }[] = [
        { value: 'learn', label: 'Learn characters', description: 'Build recognition with Koch progression.' },
        { value: 'speed', label: 'Build speed', description: 'Increase sustained copy speed.' },
        { value: 'accuracy', label: 'Improve accuracy', description: 'Practice clean, consistent copy.' },
        { value: 'weaknesses', label: 'Fix weaknesses', description: 'Target missed and confused characters.' },
        { value: 'qso', label: 'Prepare for QSOs', description: 'Practice realistic exchanges and protocol.' },
    ];

    readonly exerciseFormats: { value: ExerciseFormat; label: string }[] = [
        { value: 'groups', label: 'Copy groups' },
        { value: 'continuous', label: 'Continuous copy' },
        { value: 'instant', label: 'Instant characters' },
        { value: 'guidedQso', label: 'Guided QSO' },
        { value: 'simulatedQso', label: 'Simulated contact' },
    ];

    readonly sessionPresets: { value: SessionPreset; label: string; description: string }[] = [
        { value: 'warmup', label: 'Daily warm-up', description: 'Mixed copy at a comfortable pace' },
        { value: 'weaknesses', label: 'Weak-character repair', description: 'Target recent misses and confusions' },
        { value: 'callsigns', label: 'Callsign sprint', description: 'Fast callsign recognition' },
        { value: 'firstQso', label: 'First QSO', description: 'Guided basic exchange' },
        { value: 'onAir', label: 'On-air simulation', description: 'Full exchange with noise and QSB' },
    ];

    readonly letterDrills: { value: LetterDrill; label: string }[] = [
        { value: 'random', label: 'Random groups' },
        { value: 'koch', label: 'Koch progression' },
        { value: 'trouble', label: 'Trouble pairs' },
        { value: 'confusions', label: 'My confusion pairs' },
        { value: 'combinations', label: 'Common combinations' },
        { value: 'vowels', label: 'Vowels only' },
        { value: 'consonants', label: 'Consonants only' },
        { value: 'custom', label: 'Custom characters' },
    ];

    readonly numberDrills: { value: NumberDrill; label: string }[] = [
        { value: 'random', label: 'Random groups' },
        { value: 'dates', label: 'Dates' },
        { value: 'times', label: 'Times' },
        { value: 'frequencies', label: 'Frequencies' },
        { value: 'rst', label: 'RST reports' },
        { value: 'serials', label: 'Serial numbers' },
        { value: 'coordinates', label: 'Coordinates' },
    ];

    readonly mixedDrills: { value: MixedDrill; label: string }[] = [
        { value: 'random', label: 'Random groups' },
        { value: 'radio', label: 'Realistic radio data' },
        { value: 'confusions', label: 'My confusion pairs' },
        { value: 'custom', label: 'Custom characters' },
    ];

    readonly troublePairs = ['SH', 'UV', 'MN', 'GD', 'QY', 'XZ', 'RL', 'FP'];
    readonly kochSequence = 'KMURESNAPTLWIJZFOYVGQHBCDX';
    readonly commonCombinations = ['TH', 'HE', 'IN', 'ER', 'AN', 'RE', 'ON', 'AT', 'EN', 'ND', 'ING', 'TION'];

    readonly qsoStages: { value: QsoStage; label: string }[] = [
        { value: 'mixed', label: 'Mixed stages' },
        { value: 'frequency', label: 'Check frequency' },
        { value: 'cq', label: 'Calling CQ' },
        { value: 'answer', label: 'Answering CQ' },
        { value: 'p1', label: 'Protocol 1' },
        { value: 'p2', label: 'Protocol 2' },
        { value: 'p3', label: 'Protocol 3' },
        { value: 'recovery', label: 'Fills and recovery' },
        { value: 'closing', label: 'Closing' },
        { value: 'complete', label: 'Complete QSO' },
    ];

    readonly wordCategories: { value: WordCategory; label: string }[] = [
        { value: 'all', label: 'All vocabulary' },
        { value: 'core', label: 'Core exchange' },
        { value: 'prosigns', label: 'Prosigns' },
        { value: 'qsignals', label: 'Q signals' },
        { value: 'abbreviations', label: 'Abbreviations' },
        { value: 'recovery', label: 'Recovery' },
        { value: 'ragchew', label: 'Rag chew' },
    ];

    readonly vocabulary: Record<Exclude<WordCategory, 'all'>, readonly string[]> = {
        core: ['CQ', 'DE', 'K', 'BK', 'GM', 'GA', 'GE', 'ES', 'TNX', 'FER', 'CALL', 'RPRT', 'RST', 'QTH', 'NAME', 'OP', 'HW?', 'FB', 'CPY', 'INFO', '73', 'TU'],
        prosigns: ['AR', 'AS', 'BT', 'KN', 'SK'],
        qsignals: ['QRL?', 'QRL', 'QRS', 'QRQ', 'QSL', 'QRZ?', 'QTH', 'QSO'],
        abbreviations: ['AGN', 'ANT', 'CPI', 'CPY', 'CUAGN', 'CUL', 'ES', 'FB', 'FER', 'HPE', 'HR', 'NR', 'PSE', 'PWR', 'RPRT', 'RIG', 'SRI', 'TEMP', 'TNX', 'WX', 'YRS'],
        recovery: ['AGN?', 'CALL?', 'NAME?', 'QTH?', 'RST?', 'QRS', 'PSE', 'SRI', 'NIL', 'AGN', 'QRZ?'],
        ragchew: ['AGE', 'ANT', 'BEEN', 'CLUB', 'HAM', 'KEY', 'PADDLE', 'POTA', 'QRP', 'RIG', 'SKCC', 'SOTA', 'TEMP', 'W', 'WX', 'YRS'],
    };

    readonly prosignGlossary = [
        { token: 'AR', meaning: 'End of message' },
        { token: 'AS', meaning: 'Wait / stand by' },
        { token: 'BT', meaning: 'Break / separator' },
        { token: 'KN', meaning: 'Go only—named station' },
        { token: 'SK', meaning: 'End of contact' },
    ];

    readonly qsoGlossary: Record<string, Omit<QsoDefinition, 'token'>> = {
        '73': { meaning: 'Best regards', kind: 'Operating term' },
        AGE: { meaning: 'The operator’s age', kind: 'Operating term' },
        AGN: { meaning: 'Again', kind: 'Abbreviation' },
        'AGN?': { meaning: 'Please send that again', kind: 'Abbreviation' },
        ANT: { meaning: 'Antenna', kind: 'Abbreviation' },
        AR: { meaning: 'End of message; sent as one run-together character', kind: 'Prosign' },
        AS: { meaning: 'Wait or stand by; sent as one run-together character', kind: 'Prosign' },
        BK: { meaning: 'Break; LICW sends B and K as two separate letters', kind: 'Operating term' },
        BEEN: { meaning: 'Used when saying how long someone has been an amateur operator', kind: 'Operating term' },
        BT: { meaning: 'Break or separator between thoughts; sent as one run-together character', kind: 'Prosign' },
        'CALL?': { meaning: 'Please repeat your callsign', kind: 'Operating term' },
        CALL: { meaning: 'A call or callsign; in “TNX FER CALL,” thanks for answering', kind: 'Operating term' },
        CLUB: { meaning: 'An amateur radio club or membership', kind: 'Operating term' },
        CPI: { meaning: 'Copy or understand', kind: 'Abbreviation' },
        CPY: { meaning: 'Copy or understand', kind: 'Abbreviation' },
        CQ: { meaning: 'Calling any station', kind: 'Operating term' },
        CUAGN: { meaning: 'See you again', kind: 'Abbreviation' },
        CUL: { meaning: 'See you later', kind: 'Abbreviation' },
        DE: { meaning: 'From; identifies the transmitting station', kind: 'Operating term' },
        ES: { meaning: 'And', kind: 'Abbreviation' },
        FB: { meaning: 'Fine business; good or excellent', kind: 'Abbreviation' },
        FER: { meaning: 'For', kind: 'Abbreviation' },
        FT: { meaning: 'Feet', kind: 'Abbreviation' },
        GA: { meaning: 'Good afternoon', kind: 'Abbreviation' },
        GE: { meaning: 'Good evening', kind: 'Abbreviation' },
        GM: { meaning: 'Good morning', kind: 'Abbreviation' },
        HAM: { meaning: 'Amateur radio operator', kind: 'Operating term' },
        HPE: { meaning: 'Hope', kind: 'Abbreviation' },
        HP: { meaning: 'Hope', kind: 'Abbreviation' },
        HR: { meaning: 'Here', kind: 'Abbreviation' },
        'HW?': { meaning: 'How do you copy me?', kind: 'Abbreviation' },
        K: { meaning: 'Over; invitation for any station to transmit', kind: 'Operating term' },
        INFO: { meaning: 'Information', kind: 'Abbreviation' },
        KEY: { meaning: 'The device used to send Morse code', kind: 'Operating term' },
        KN: { meaning: 'Over only to the named station; sent as one run-together character', kind: 'Prosign' },
        'NAME?': { meaning: 'Please repeat your name', kind: 'Operating term' },
        NAME: { meaning: 'The operator’s name', kind: 'Operating term' },
        NIL: { meaning: 'Nothing heard or nothing received', kind: 'Abbreviation' },
        NR: { meaning: 'Number', kind: 'Abbreviation' },
        OM: { meaning: 'Old man; friendly term for a male operator', kind: 'Abbreviation' },
        OP: { meaning: 'Operator or operator name', kind: 'Abbreviation' },
        POTA: { meaning: 'Parks On The Air', kind: 'Operating term' },
        PADDLE: { meaning: 'A keying device used with an electronic keyer', kind: 'Operating term' },
        PSE: { meaning: 'Please', kind: 'Abbreviation' },
        PWR: { meaning: 'Transmitter power', kind: 'Abbreviation' },
        QRL: { meaning: 'The frequency is in use', kind: 'Q signal' },
        'QRL?': { meaning: 'Is this frequency in use?', kind: 'Q signal' },
        QRP: { meaning: 'Low-power operation, commonly five watts or less on CW', kind: 'Q signal' },
        QRQ: { meaning: 'Send faster', kind: 'Q signal' },
        QRS: { meaning: 'Send more slowly', kind: 'Q signal' },
        QRZ: { meaning: 'Who is calling me?', kind: 'Q signal' },
        'QRZ?': { meaning: 'Who is calling me?', kind: 'Q signal' },
        QSL: { meaning: 'I acknowledge or confirm receipt', kind: 'Q signal' },
        QSO: { meaning: 'A radio contact or conversation', kind: 'Q signal' },
        QTH: { meaning: 'Station location', kind: 'Q signal' },
        'QTH?': { meaning: 'What is your location, or please repeat your location?', kind: 'Q signal' },
        R: { meaning: 'Received correctly', kind: 'Operating term' },
        RIG: { meaning: 'Radio equipment', kind: 'Operating term' },
        RPRT: { meaning: 'Report', kind: 'Abbreviation' },
        RR: { meaning: 'Roger roger; fully received and understood', kind: 'Abbreviation' },
        RST: { meaning: 'Readability, signal strength, and tone report', kind: 'Operating term' },
        'RST?': { meaning: 'Please repeat the signal report', kind: 'Operating term' },
        SK: { meaning: 'End of contact; sent as one run-together character', kind: 'Prosign' },
        SKCC: { meaning: 'Straight Key Century Club', kind: 'Operating term' },
        SOTA: { meaning: 'Summits On The Air', kind: 'Operating term' },
        SRI: { meaning: 'Sorry', kind: 'Abbreviation' },
        TEMP: { meaning: 'Temperature', kind: 'Abbreviation' },
        TKS: { meaning: 'Thanks', kind: 'Abbreviation' },
        TNX: { meaning: 'Thanks', kind: 'Abbreviation' },
        TU: { meaning: 'Thank you', kind: 'Abbreviation' },
        UR: { meaning: 'Your or you are, depending on context', kind: 'Abbreviation' },
        W: { meaning: 'Watts of transmitter power', kind: 'Abbreviation' },
        WX: { meaning: 'Weather', kind: 'Abbreviation' },
        YL: { meaning: 'Young lady; traditional term for a female operator', kind: 'Abbreviation' },
        YRS: { meaning: 'Years', kind: 'Abbreviation' },
    };

    private audioContext: AudioContext | null = null;
    private activeSources: AudioScheduledSourceNode[] = [];
    private playbackTimer: number | null = null;
    private progressTimer: number | null = null;
    private playbackStartedAt = 0;
    private playbackOffset = 0;
    private timeline: ToneEvent[] = [];
    private toastTimer: number | null = null;
    private practiceAttempts: CwPracticeAttempt[] = [];
    private exercisePlayCount = 0;
    private sessionId = this.createSessionId();
    private readonly uiStateVersion = 2;

    private readonly morse: Record<string, string> = {
        A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
        H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
        O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
        V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
        '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
        '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
        '/': '-..-.', '?': '..--..', '.': '.-.-.-', ',': '--..--', ':': '---...', '-': '-....-',
    };

    private readonly joinedProsigns = new Set(['AR', 'AS', 'BT', 'KN', 'SK']);
    private readonly audioPaddingSeconds = 1;

    constructor(private http: HttpClient) {
        this.initializeOperatorState();
        this.pendingMetricCount = this.readPendingMetrics().length;
    }

    ngOnInit(): void {
        this.loadServerOperator(this.activeOperator);
        this.flushPendingMetrics();
        this.loadPracticeMetrics();
    }

    get accuracy(): number {
        return this.totalCharacters ? Math.round((this.correctCharacters / this.totalCharacters) * 100) : 0;
    }

    get history(): CopyResult[] {
        return this.results.slice(0, 5);
    }

    get effectiveCopyWpm(): number {
        return Math.round(this.farnsworthWpm * this.accuracy) / 100;
    }

    get sessionProgressPercent(): number {
        return Math.min(100, this.attempts * 100 / Math.max(1, this.sessionTargetAttempts));
    }

    get sessionProgressLabel(): string {
        return this.attempts >= this.sessionTargetAttempts ? 'Session complete' : `Exercise ${this.attempts + 1} of ${this.sessionTargetAttempts}`;
    }

    get missedCharactersThisExercise(): string[] {
        return [...new Set(this.expectedMarks.filter((mark) => mark.status === 'missing').map((mark) => mark.character))];
    }

    get incorrectCharactersThisExercise(): string[] {
        return [...new Set(this.expectedMarks.filter((mark) => mark.status === 'incorrect').map((mark) => mark.character))];
    }

    get extraCharactersThisExercise(): string[] {
        return [...new Set(this.copyMarks.filter((mark) => mark.status === 'extra').map((mark) => mark.character))];
    }

    isMetricTraceVisible(chart: 'trend' | 'speed', series: CwTrendSeries | CwSpeedSeries, traceKey: string): boolean {
        return !this.hiddenMetricTraces.has(this.metricTraceKey(chart, series.mode, series.drill, traceKey));
    }

    toggleMetricTrace(chart: 'trend' | 'speed', series: CwTrendSeries | CwSpeedSeries, traceKey: string): void {
        const key = this.metricTraceKey(chart, series.mode, series.drill, traceKey);
        if (this.hiddenMetricTraces.has(key)) this.hiddenMetricTraces.delete(key);
        else this.hiddenMetricTraces.add(key);
    }

    get progressPercent(): number {
        return this.playbackDuration ? Math.min(100, (this.playbackPosition / this.playbackDuration) * 100) : 0;
    }

    get secondsRemaining(): number {
        return Math.max(0, Math.ceil(this.playbackDuration - this.playbackPosition));
    }

    get secondsElapsed(): number {
        return Math.max(0, Math.floor(this.playbackPosition));
    }

    get isBasicMode(): boolean {
        return this.mode === 'letters' || this.mode === 'numbers' || this.mode === 'mixed';
    }

    get activeTrainingGoalDescription(): string {
        return this.trainingGoals.find((goal) => goal.value === this.trainingGoal)?.description ?? '';
    }

    get activeContentDescription(): string {
        return this.modes.find((option) => option.value === this.mode)?.description ?? '';
    }

    get activeTrainingGoalLabel(): string {
        return this.trainingGoals.find((goal) => goal.value === this.trainingGoal)?.label ?? this.trainingGoal;
    }

    get activeContentLabel(): string {
        return this.modes.find((option) => option.value === this.mode)?.label ?? this.mode;
    }

    get activeExerciseFormatLabel(): string {
        return this.exerciseFormats.find((format) => format.value === this.exerciseFormat)?.label ?? this.exerciseFormat;
    }

    get activePresetLabel(): string {
        if (!this.activePreset) return 'Custom session';
        return this.sessionPresets.find((preset) => preset.value === this.activePreset)?.label ?? 'Custom session';
    }

    get sessionLengthLabel(): string {
        if (this.exerciseFormat === 'instant') return 'One character at a time';
        if (this.exerciseFormat === 'continuous') return `${this.timedMinutes}-minute stream`;
        if (this.mode === 'qso') return this.qsoStages.find((stage) => stage.value === this.qsoStage)?.label ?? 'QSO exchange';
        return `${this.groupCount} ${this.mode === 'qsoWords' ? 'words' : 'groups'}`;
    }

    get visibleMetricTrends(): CwTrendSeries[] {
        return this.metricTrends
            .filter((series) => this.showAllMetricConditions || (series.mode === this.mode && series.drill === this.currentDrillName()))
            .map((series) => ({ ...series, traces: this.showAllMetricConditions ? series.traces : series.traces.filter((trace) => trace.key.endsWith(`|${this.currentMetricConditionKey()}`)) }))
            .filter((series) => series.traces.length > 0);
    }

    get visibleSpeedAccuracySeries(): CwSpeedSeries[] {
        return this.speedAccuracySeries
            .filter((series) => this.showAllMetricConditions || (series.mode === this.mode && series.drill === this.currentDrillName()))
            .map((series) => ({ ...series, traces: this.showAllMetricConditions ? series.traces : series.traces.filter((trace) => trace.key.endsWith(`|${this.currentMetricConditionKey()}`)) }))
            .filter((series) => series.traces.length > 0);
    }

    get visibleProficiencySummaries(): CwProficiency[] {
        return this.proficiencySummaries
            .filter((summary) => this.showAllMetricConditions || (summary.mode === this.mode && summary.drill === this.currentDrillName()))
            .map((summary) => ({ ...summary, speeds: this.showAllMetricConditions ? summary.speeds : summary.speeds.filter((speed) => speed.key.endsWith(`|${this.currentMetricConditionKey()}`)) }))
            .filter((summary) => summary.speeds.length > 0);
    }

    get performanceOverview(): CwPerformanceOverview | null {
        const values = this.practiceAttempts.filter((attempt) => this.showAllMetricConditions
            || (attempt.mode === this.mode && attempt.drill === this.currentDrillName() && this.metricConditionKey(attempt) === this.currentMetricConditionKey()));
        if (!values.length) return null;

        const aggregate = (items: CwPracticeAttempt[]) => {
            const characters = items.reduce((sum, attempt) => sum + attempt.totalCharacters, 0);
            const correct = items.reduce((sum, attempt) => sum + attempt.correctCharacters, 0);
            return { characters, correct, accuracy: characters ? correct * 100 / characters : 0 };
        };
        const all = aggregate(values);
        const now = Date.now();
        let recencyCorrect = 0;
        let recencyCharacters = 0;
        values.forEach((attempt) => {
            const ageDays = Math.max(0, (now - Date.parse(attempt.createdAt ?? new Date().toISOString())) / 86_400_000);
            const weight = Math.exp(-ageDays / 30);
            recencyCorrect += attempt.correctCharacters * weight;
            recencyCharacters += attempt.totalCharacters * weight;
        });
        const [confidenceLow, confidenceHigh] = this.wilsonInterval(recencyCorrect, recencyCharacters);
        const recentScores = values.slice(0, 20).map((attempt) => attempt.accuracy);
        const scoreMean = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
        const spread = Math.sqrt(recentScores.reduce((sum, score) => sum + (score - scoreMean) ** 2, 0) / recentScores.length);
        const consistency: CwPerformanceOverview['consistency'] = spread < 5 ? 'High' : spread < 10 ? 'Moderate' : 'Variable';

        const speedBuckets = new Map<string, CwPracticeAttempt[]>();
        values.forEach((attempt) => {
            const key = `${attempt.wpm}/${attempt.farnsworthWpm}`;
            speedBuckets.set(key, [...(speedBuckets.get(key) ?? []), attempt]);
        });
        const reliable = [...speedBuckets.entries()]
            .map(([label, items]) => ({ label, ...aggregate(items), wpm: items[0].wpm, farnsworthWpm: items[0].farnsworthWpm }))
            .filter((bucket) => bucket.characters >= 100 && bucket.accuracy >= 90 && this.wilsonInterval(bucket.correct, bucket.characters)[0] >= 80)
            .sort((a, b) => b.farnsworthWpm - a.farnsworthWpm || b.wpm - a.wpm)[0];

        const recent = aggregate(values.filter((attempt) => now - Date.parse(attempt.createdAt ?? '') <= 7 * 86_400_000));
        const prior = aggregate(values.filter((attempt) => {
            const age = now - Date.parse(attempt.createdAt ?? '');
            return age > 7 * 86_400_000 && age <= 30 * 86_400_000;
        }));
        const retentionDelta = recent.characters >= 50 && prior.characters >= 50 ? recent.accuracy - prior.accuracy : null;
        const retention = retentionDelta === null ? 'Collecting data' : retentionDelta < -3 ? 'Slipping' : retentionDelta > 3 ? 'Improving' : 'Stable';

        const knownPlayCounts = values.filter((attempt) => attempt.playCount !== null && attempt.playCount !== undefined);
        const firstPlay = aggregate(knownPlayCounts.filter((attempt) => attempt.playCount === 1));
        const repeated = aggregate(knownPlayCounts.filter((attempt) => (attempt.playCount ?? 0) > 1));
        const knownReveals = values.filter((attempt) => attempt.revealedBeforeCheck !== null && attempt.revealedBeforeCheck !== undefined);

        const sessions = new Map<string, CwPracticeAttempt[]>();
        values.filter((attempt) => attempt.sessionId).forEach((attempt) => sessions.set(attempt.sessionId!, [...(sessions.get(attempt.sessionId!) ?? []), attempt]));
        const firstThird: CwPracticeAttempt[] = [];
        const lastThird: CwPracticeAttempt[] = [];
        sessions.forEach((items) => {
            const ordered = items.slice().sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
            if (ordered.length < 6) return;
            const size = Math.max(1, Math.floor(ordered.length / 3));
            firstThird.push(...ordered.slice(0, size));
            lastThird.push(...ordered.slice(-size));
        });
        const firstFatigue = aggregate(firstThird);
        const lastFatigue = aggregate(lastThird);
        const fatigueDelta = firstFatigue.characters && lastFatigue.characters ? lastFatigue.accuracy - firstFatigue.accuracy : null;

        const knownErrors = values.filter((attempt) => attempt.missingCount !== null && attempt.missingCount !== undefined);
        const errorCharacters = knownErrors.reduce((sum, attempt) => sum + attempt.totalCharacters, 0);
        const misses = knownErrors.reduce((sum, attempt) => sum + (attempt.missingCount ?? 0), 0);
        const incorrect = knownErrors.reduce((sum, attempt) => sum + (attempt.incorrectCount ?? 0), 0);
        const extras = knownErrors.reduce((sum, attempt) => sum + (attempt.extraCount ?? 0), 0);
        const weakCounts: Record<string, number> = {};
        const characterEvidence: Record<string, { attempts: number; correct: number }> = {};
        values.forEach((attempt) => Object.entries(attempt.missedCharacters ?? {}).forEach(([character, count]) => weakCounts[character] = (weakCounts[character] ?? 0) + count));
        values.forEach((attempt) => Object.entries(attempt.characterAttempts ?? {}).forEach(([character, count]) => {
            const evidence = characterEvidence[character] ?? { attempts: 0, correct: 0 };
            evidence.attempts += count;
            evidence.correct += attempt.characterCorrect?.[character] ?? 0;
            characterEvidence[character] = evidence;
        }));
        const weakestFromEvidence = Object.entries(characterEvidence)
            .filter(([, evidence]) => evidence.attempts >= 3)
            .sort((a, b) => a[1].correct / a[1].attempts - b[1].correct / b[1].attempts || b[1].attempts - a[1].attempts)
            .slice(0, 5)
            .map(([character]) => character);

        const audioGroups = new Map<string, CwPracticeAttempt[]>();
        values.forEach((attempt) => {
            const label = attempt.audioEffect ?? 'legacy';
            audioGroups.set(label, [...(audioGroups.get(label) ?? []), attempt]);
        });

        return {
            attempts: values.length,
            characters: all.characters,
            weightedAccuracy: this.roundMetric(all.accuracy),
            masteryAccuracy: this.roundMetric(recencyCharacters ? recencyCorrect * 100 / recencyCharacters : 0),
            confidenceLow: this.roundMetric(confidenceLow),
            confidenceHigh: this.roundMetric(confidenceHigh),
            effectiveWpm: this.roundMetric(values.reduce((sum, attempt) => sum + attempt.farnsworthWpm * attempt.correctCharacters, 0) / Math.max(1, all.characters)),
            consistency,
            consistencySpread: this.roundMetric(spread),
            reliableSpeed: reliable ? `${reliable.label} WPM` : 'Building evidence',
            retention,
            retentionDelta: retentionDelta === null ? null : this.roundMetric(retentionDelta),
            firstPlayAccuracy: firstPlay.characters ? this.roundMetric(firstPlay.accuracy) : null,
            repeatedAccuracy: repeated.characters ? this.roundMetric(repeated.accuracy) : null,
            revealRate: knownReveals.length ? this.roundMetric(knownReveals.filter((attempt) => attempt.revealedBeforeCheck).length * 100 / knownReveals.length) : null,
            fatigueDelta: fatigueDelta === null ? null : this.roundMetric(fatigueDelta),
            missingRate: errorCharacters ? this.roundMetric(misses * 100 / errorCharacters) : null,
            incorrectRate: errorCharacters ? this.roundMetric(incorrect * 100 / errorCharacters) : null,
            extraRate: errorCharacters ? this.roundMetric(extras * 100 / errorCharacters) : null,
            weakestCharacters: weakestFromEvidence.length ? weakestFromEvidence : Object.entries(weakCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([character]) => character),
            audioBreakdown: [...audioGroups.entries()].map(([label, items]) => ({ label, accuracy: this.roundMetric(aggregate(items).accuracy), characters: aggregate(items).characters })),
        };
    }

    selectWorkspace(view: WorkspaceView): void {
        this.activeWorkspace = view;
        if (this.mobileSetupOpen) this.closeMobileSetup(false);
        if (view === 'progress') this.loadPracticeMetrics();
        this.persistUiState();
    }

    setMetricScope(showAll: boolean): void {
        this.showAllMetricConditions = showAll;
        this.selectedMetricPoint = '';
        this.persistUiState();
    }

    toggleSettingsSection(section: SettingsSection, open: boolean): void {
        this.settingsSections[section] = open;
        this.persistUiState();
    }

    selectMetricPoint(characterWpm: number, farnsworthWpm: number, accuracy: number, detail: string): void {
        this.selectedMetricPoint = `${characterWpm}/${farnsworthWpm} WPM · ${accuracy}% · ${detail}`;
    }

    openMobileSetup(): void {
        this.mobileSetupOpen = true;
        this.settingsSections.advanced = false;
        window.setTimeout(() => {
            const firstControl = this.mobileSetupDrawer?.nativeElement.querySelector<HTMLElement>('button, select, input, textarea, [tabindex]:not([tabindex="-1"])');
            (firstControl ?? this.mobileSetupDrawer?.nativeElement)?.focus();
        }, 0);
    }

    closeMobileSetup(restoreFocus = true): void {
        this.mobileSetupOpen = false;
        if (restoreFocus) window.setTimeout(() => this.mobileSetupTrigger?.nativeElement.focus(), 0);
    }

    retryExercise(): void {
        this.stop();
        this.copy = '';
        this.hasChecked = false;
        this.answerRevealed = false;
        this.expectedMarks = [];
        this.copyMarks = [];
        this.playbackPosition = 0;
        window.setTimeout(() => this.copyInput?.nativeElement.focus(), 0);
        this.play();
    }

    get availableExerciseFormats(): { value: ExerciseFormat; label: string }[] {
        if (this.mode === 'qso') return this.exerciseFormats.filter((format) => format.value === 'guidedQso' || format.value === 'simulatedQso');
        if (this.isBasicMode) return this.exerciseFormats.filter((format) => format.value === 'groups' || format.value === 'continuous' || format.value === 'instant');
        return this.exerciseFormats.filter((format) => format.value === 'groups');
    }

    get playbackStatus(): string {
        if (this.isPlaying && this.playbackPosition < this.countdownSeconds) {
            return `Starts in ${Math.ceil(this.countdownSeconds - this.playbackPosition)}`;
        }
        return this.isPlaying ? 'Sending…' : this.isPaused ? 'Paused' : 'Ready';
    }

    get revealedExercise(): string {
        if (this.hasChecked || this.revealMode !== 'groups') return this.exercise;
        return this.exercise.split(/\s+/).slice(0, this.revealedGroupCount).join(' ');
    }

    get weakWords(): { word: string; misses: number }[] {
        return Object.entries(this.weakWordCounts)
            .filter(([, misses]) => misses > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([word, misses]) => ({ word, misses }));
    }

    get weakCharacters(): { character: string; misses: number }[] {
        return Object.entries(this.weakCharacterCounts)
            .filter(([, misses]) => misses > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([character, misses]) => ({ character, misses }));
    }

    get topConfusions(): { expected: string; copied: string; count: number }[] {
        return Object.entries(this.confusionCounts)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([pair, count]) => {
                const [expected, copied] = pair.split('>');
                return { expected, copied, count };
            });
    }

    get activeProsigns(): { token: string; meaning: string }[] {
        const tokens = new Set(this.exercise.split(/\s+/));
        return this.prosignGlossary.filter((item) => tokens.has(item.token));
    }

    get activeQsoDefinitions(): QsoDefinition[] {
        if (this.mode !== 'qso' && this.mode !== 'qsoWords') return [];
        const exerciseTokens = this.exercise.split(/\s+/).filter(Boolean);
        const tokens = this.mode === 'qsoWords' ? exerciseTokens : [...new Set(exerciseTokens)];
        return tokens
            .filter((token) => Boolean(this.qsoGlossary[token]))
            .map((token) => ({ token, ...this.qsoGlossary[token] }));
    }

    selectMode(mode: PracticeMode): void {
        this.selectContent(mode);
    }

    selectTrainingGoal(goal: string): void {
        this.markPresetModified();
        this.trainingGoal = goal as TrainingGoal;
        if (this.trainingGoal === 'learn') {
            this.mode = 'letters';
            this.letterDrill = 'koch';
            this.adaptiveCharacters = false;
            this.adaptiveSpeed = false;
            this.applyExerciseFormat('groups');
            this.audioEffect = 'clean';
        } else if (this.trainingGoal === 'speed') {
            if (!this.isBasicMode) this.mode = 'mixed';
            this.adaptiveCharacters = false;
            this.adaptiveSpeed = true;
            this.applyExerciseFormat('continuous');
        } else if (this.trainingGoal === 'accuracy') {
            this.adaptiveCharacters = false;
            this.adaptiveSpeed = false;
            if (this.mode === 'qso') this.mode = 'mixed';
            this.applyExerciseFormat('groups');
            this.audioEffect = 'clean';
        } else if (this.trainingGoal === 'weaknesses') {
            if (!this.isBasicMode) this.mode = 'letters';
            this.adaptiveCharacters = true;
            this.adaptiveSpeed = false;
            if (this.mode === 'letters') this.letterDrill = 'confusions';
            if (this.mode === 'mixed') this.mixedDrill = 'confusions';
            this.applyExerciseFormat('groups');
        } else {
            this.mode = 'qso';
            this.adaptiveCharacters = false;
            this.adaptiveSpeed = false;
            this.applyExerciseFormat('guidedQso');
        }
        this.resetExercise();
        this.persistUiState();
    }

    selectContent(mode: PracticeMode): void {
        this.markPresetModified();
        this.mode = mode;
        if (mode === 'qso') {
            if (this.exerciseFormat !== 'guidedQso' && this.exerciseFormat !== 'simulatedQso') this.applyExerciseFormat('guidedQso');
        } else if (!this.availableExerciseFormats.some((format) => format.value === this.exerciseFormat)) {
            this.applyExerciseFormat('groups');
        }
        if (mode === 'letters' && this.letterDrill === 'custom' && !/[A-Z]/.test(this.customCharacters)) this.letterDrill = 'random';
        this.resetExercise();
    }

    selectExerciseFormat(format: string): void {
        this.markPresetModified();
        this.applyExerciseFormat(format as ExerciseFormat);
        this.resetExercise();
    }

    applySessionPreset(preset: SessionPreset): void {
        this.repeatCount = 1;
        this.strictSpacing = true;
        this.countdownSeconds = 0;
        this.revealMode = 'check';
        this.adaptiveCharacters = false;
        this.adaptiveSpeed = false;
        this.audioEffect = 'clean';
        if (preset === 'warmup') {
            this.trainingGoal = 'accuracy';
            this.mode = 'mixed';
            this.mixedDrill = 'radio';
            this.wpm = 17;
            this.farnsworthWpm = 7;
            this.groupSize = 5;
            this.groupCount = 5;
            this.applyExerciseFormat('groups');
        } else if (preset === 'weaknesses') {
            this.trainingGoal = 'weaknesses';
            this.mode = 'letters';
            this.letterDrill = 'confusions';
            this.adaptiveCharacters = true;
            this.applyExerciseFormat('groups');
        } else if (preset === 'callsigns') {
            this.trainingGoal = 'speed';
            this.mode = 'callsigns';
            this.wpm = 20;
            this.farnsworthWpm = 15;
            this.groupCount = 10;
            this.applyExerciseFormat('groups');
        } else if (preset === 'firstQso') {
            this.trainingGoal = 'qso';
            this.mode = 'qso';
            this.qsoStage = 'p1';
            this.wpm = 15;
            this.farnsworthWpm = 8;
            this.applyExerciseFormat('guidedQso');
        } else {
            this.trainingGoal = 'qso';
            this.mode = 'qso';
            this.qsoStage = 'complete';
            this.wpm = 18;
            this.farnsworthWpm = 12;
            this.audioEffect = 'light';
            this.applyExerciseFormat('simulatedQso');
        }
        this.activePreset = preset;
        this.presetModified = false;
        this.resetExercise();
        this.persistUiState();
        this.showToast(`${this.activePresetLabel} applied`, 'success');
    }

    selectQsoStage(stage: string): void {
        this.markPresetModified();
        this.qsoStage = stage as QsoStage;
        this.exerciseFormat = this.qsoStage === 'complete' ? 'simulatedQso' : 'guidedQso';
        this.resetExercise();
    }

    selectWordCategory(category: string): void {
        this.markPresetModified();
        this.wordCategory = category as WordCategory;
        this.resetExercise();
    }

    selectDrill(kind: 'letter' | 'number' | 'mixed', value: string): void {
        this.markPresetModified();
        if (kind === 'letter') this.letterDrill = value as LetterDrill;
        if (kind === 'number') this.numberDrill = value as NumberDrill;
        if (kind === 'mixed') this.mixedDrill = value as MixedDrill;
        this.resetExercise();
    }

    selectOption(setting: 'troublePair' | 'revealMode', value: string): void {
        this.markPresetModified();
        if (setting === 'troublePair') this.troublePair = value;
        else this.revealMode = value as RevealMode;
        this.resetExercise();
    }

    updateCustomCharacters(value: string): void {
        this.markPresetModified();
        const supported = value.toUpperCase().split('').filter((character) => Boolean(this.morse[character]));
        this.customCharacters = [...new Set(supported)].join('');
        this.resetExercise();
    }

    toggleSetting(setting: 'adaptiveCharacters' | 'adaptiveSpeed' | 'instantCharacters' | 'strictSpacing', checked: boolean): void {
        this.markPresetModified();
        this[setting] = checked;
        if (setting === 'instantCharacters' && checked) {
            this.timedMinutes = 0;
            this.repeatCount = 1;
            this.exerciseFormat = 'instant';
        } else if (setting === 'instantCharacters' && this.exerciseFormat === 'instant') {
            this.exerciseFormat = 'groups';
        }
        this.resetExercise();
    }

    selectAudioEffect(effect: string): void {
        this.markPresetModified();
        this.audioEffect = effect as AudioEffect;
        this.stop();
        if (this.exercise) this.prepareTimeline();
    }

    updateProfile(field: keyof StationProfile, value: string): void {
        this.profile = { ...this.profile, [field]: this.normalize(value) };
        this.profileSaved = false;
    }

    saveProfile(): void {
        const operator = this.sanitizeOperator(this.profile.call) || this.activeOperator;
        this.activeOperator = operator;
        this.profile = { ...this.profile, call: operator };
        localStorage.setItem('cw-copy-active-operator', operator);
        localStorage.setItem(this.storageKey('profile'), JSON.stringify(this.profile));
        this.persistUiState();
        this.profileSaved = true;
        this.resetExercise();
        this.loadPracticeMetrics();
        this.saveServerOperator(true);
    }

    updateNumber(setting: 'wpm' | 'farnsworthWpm' | 'tone' | 'groupSize' | 'groupCount' | 'kochLevel' | 'repeatCount' | 'countdownSeconds' | 'timedMinutes' | 'mixedLetterPercent' | 'sessionTargetAttempts', value: string): void {
        this.markPresetModified();
        const ranges = {
            wpm: [5, 40], farnsworthWpm: [5, this.wpm], tone: [350, 900],
            groupSize: [1, 8], groupCount: [1, 10], kochLevel: [2, 26],
            repeatCount: [1, 3], countdownSeconds: [0, 5], timedMinutes: [0, 5],
            mixedLetterPercent: [0, 100],
            sessionTargetAttempts: [5, 25],
        } as const;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;
        if (setting === 'repeatCount' && this.isBasicMode && this.instantCharacters) return;
        const [minimum, maximum] = ranges[setting];
        this[setting] = Math.min(maximum, Math.max(minimum, parsed));
        if (setting === 'wpm' && this.farnsworthWpm > this.wpm) this.farnsworthWpm = this.wpm;
        if (setting === 'timedMinutes' && this.isBasicMode && !this.instantCharacters) this.exerciseFormat = this.timedMinutes > 0 ? 'continuous' : 'groups';
        if (['groupSize', 'groupCount', 'kochLevel', 'repeatCount', 'countdownSeconds', 'timedMinutes', 'mixedLetterPercent'].includes(setting)) this.resetExercise();
        else {
            this.stop();
            if (this.exercise && (setting === 'wpm' || setting === 'farnsworthWpm')) this.prepareTimeline();
        }
    }

    newExercise(playImmediately = true): void {
        this.stop();
        const generated = this.generateExercise();
        this.exercise = generated.text;
        this.exerciseContext = generated.context;
        this.copy = '';
        this.hasChecked = false;
        this.answerRevealed = false;
        this.revealedGroupCount = 0;
        this.expectedMarks = [];
        this.copyMarks = [];
        this.exercisePlayCount = 0;
        this.prepareTimeline();
        window.setTimeout(() => this.copyInput?.nativeElement.focus(), 0);
        if (playImmediately) this.play();
    }

    play(): void {
        if (!this.exercise) this.newExercise(false);
        const startingFromBeginning = this.playbackPosition <= 0 || this.playbackPosition >= this.playbackDuration;
        if (this.playbackPosition >= this.playbackDuration) this.playbackPosition = 0;
        if (startingFromBeginning) this.exercisePlayCount += 1;
        this.clearPlayback(false);

        const AudioContextClass = window.AudioContext
            ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        this.audioContext ??= new AudioContextClass();
        void this.audioContext.resume();

        const events = this.timeline.length ? this.timeline : this.buildTimeline();
        const context = this.audioContext;
        const startAt = context.currentTime + 0.05;
        const offset = this.playbackPosition;
        const master = context.createGain();
        master.gain.value = this.audioEffect === 'challenging' ? 0.09 : 0.12;
        master.connect(context.destination);

        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = this.tone;
        envelope.gain.value = 0.001;
        oscillator.connect(envelope);
        envelope.connect(master);

        events.filter((event) => event.start + event.duration > offset).forEach((event) => {
            const elapsed = Math.max(0, offset - event.start);
            const duration = event.duration - elapsed;
            const qsb = this.audioEffect === 'clean' ? 1 : 0.45 + Math.random() * 0.55;
            const drift = this.audioEffect === 'challenging' ? (Math.random() - 0.5) * 24 : this.audioEffect === 'light' ? (Math.random() - 0.5) * 6 : 0;
            const eventStart = startAt + Math.max(0, event.start - offset);
            oscillator.frequency.setValueAtTime(this.tone + drift, eventStart);
            envelope.gain.setValueAtTime(0.001, eventStart);
            envelope.gain.linearRampToValueAtTime(qsb, eventStart + Math.min(0.004, duration / 4));
            envelope.gain.setValueAtTime(qsb, eventStart + Math.max(0.004, duration - 0.004));
            envelope.gain.linearRampToValueAtTime(0.001, eventStart + duration);
        });
        oscillator.start(startAt);
        oscillator.stop(startAt + Math.max(0.01, this.playbackDuration - offset));
        this.activeSources.push(oscillator);

        if (this.audioEffect !== 'clean') this.scheduleNoise(startAt, this.playbackDuration - offset, master);

        this.playbackStartedAt = context.currentTime;
        this.playbackOffset = offset;
        this.isPlaying = true;
        this.isPaused = false;
        this.progressTimer = window.setInterval(() => this.updatePlaybackPosition(), 100);
        this.playbackTimer = window.setTimeout(() => this.finishPlayback(), Math.max(0, (this.playbackDuration - offset + 0.1) * 1000));
    }

    pause(): void {
        if (!this.isPlaying) return;
        this.updatePlaybackPosition();
        this.clearPlayback(false);
        this.isPaused = true;
    }

    seekPlayback(value: string): void {
        if (!this.exercise || !this.playbackDuration) return;
        const nextPosition = Math.min(this.playbackDuration, Math.max(0, Number(value)));
        if (!Number.isFinite(nextPosition)) return;
        const resume = this.isPlaying;
        this.clearPlayback(false);
        this.playbackPosition = nextPosition;
        this.isPaused = !resume && nextPosition > 0 && nextPosition < this.playbackDuration;
        if (resume && nextPosition < this.playbackDuration) this.play();
    }

    stop(): void {
        this.clearPlayback(true);
    }

    onCopyInput(value: string): void {
        this.copy = value.toUpperCase();
        this.hasChecked = false;
        if (this.isBasicMode && this.instantCharacters && this.copy.trim().length === 1) {
            window.setTimeout(() => this.checkCopy(), 0);
        }
    }

    revealNextGroup(): void {
        const groupTotal = this.exercise.split(/\s+/).filter(Boolean).length;
        this.answerRevealed = true;
        this.revealedGroupCount = Math.min(groupTotal, this.revealedGroupCount + 1);
    }

    checkCopy(): void {
        if (!this.exercise || !this.copy.trim()) return;
        const revealedBeforeCheck = this.answerRevealed;
        this.clearPlayback(false);
        this.playbackPosition = this.playbackDuration;
        const expected = this.strictSpacing ? this.normalize(this.exercise) : this.exercise.replace(/\s+/g, '');
        const copied = this.strictSpacing ? this.normalize(this.copy) : this.normalize(this.copy).replaceAll(' ', '');
        const comparison = this.alignCharacters(expected, copied);
        const denominator = Math.max(expected.length, copied.length, 1);
        const exerciseAccuracy = Math.round((comparison.correct / denominator) * 100);

        this.expectedMarks = comparison.expected;
        this.copyMarks = comparison.copied;
        this.correctCharacters += comparison.correct;
        this.totalCharacters += denominator;
        this.attempts += 1;
        this.hasChecked = true;
        this.answerRevealed = true;
        this.trackWeakWords();
        this.trackWeakCharacters();
        this.trackConfusions(comparison.confusions);
        this.results = [{
            expected: this.exercise,
            copied: this.normalize(this.copy),
            accuracy: exerciseAccuracy,
            correct: exerciseAccuracy === 100,
            mode: this.modes.find((item) => item.value === this.mode)?.label ?? this.mode,
            detail: this.mode === 'qso' ? this.qsoStages.find((item) => item.value === this.qsoStage)?.label ?? '' : this.mode === 'qsoWords' ? this.wordCategories.find((item) => item.value === this.wordCategory)?.label ?? '' : '',
            wpm: this.wpm,
            farnsworthWpm: this.farnsworthWpm,
            effectiveCopyWpm: Math.round(this.farnsworthWpm * exerciseAccuracy) / 100,
        }, ...this.results];
        this.savePracticeMetric(exerciseAccuracy, comparison.correct, denominator, comparison.confusions, revealedBeforeCheck);
        if (this.adaptiveSpeed && this.isBasicMode) this.adjustAdaptiveSpeed(exerciseAccuracy);
        if (this.instantCharacters && this.isBasicMode) window.setTimeout(() => this.newExercise(), 700);
    }

    resetSession(): void {
        this.stop();
        this.exercise = '';
        this.exerciseContext = '';
        this.copy = '';
        this.hasChecked = false;
        this.answerRevealed = false;
        this.revealedGroupCount = 0;
        this.expectedMarks = [];
        this.copyMarks = [];
        this.correctCharacters = 0;
        this.totalCharacters = 0;
        this.attempts = 0;
        this.results = [];
        this.sessionId = this.createSessionId();
        this.showToast('Session reset', 'info');
    }

    confirmResetSession(): void {
        if (!this.attempts || window.confirm('Reset this practice session and clear its current results?')) this.resetSession();
    }

    clearWeakWords(): void {
        this.weakWordCounts = {};
        this.weakCharacterCounts = {};
        this.confusionCounts = {};
        localStorage.removeItem(this.storageKey('weak-words'));
        localStorage.removeItem(this.storageKey('weak-characters'));
        localStorage.removeItem(this.storageKey('confusions'));
        this.showToast('Review list cleared', 'info');
    }

    confirmClearWeakWords(): void {
        if (window.confirm('Clear all saved weak characters, words, and confusion pairs?')) this.clearWeakWords();
    }

    loadPracticeMetrics(): void {
        const operator = this.profile.call.trim() || 'N0CALL';
        this.metricsLoading = true;
        const params = new HttpParams().set('operator', operator).set('limit', 300);
        this.http.get<CwPracticeAttempt[]>(`${environment.apiUrl}/cw-practice-attempts`, { params }).subscribe({
            next: (attempts) => {
                this.metricsOnline = true;
                this.metricsLoading = false;
                this.practiceAttempts = attempts;
                this.metricTrends = this.buildMetricTrends(attempts);
                this.speedAccuracySeries = this.buildSpeedAccuracySeries(attempts);
                this.proficiencySummaries = this.buildProficiencySummaries(attempts);
                this.applyServerCharacterScores(attempts);
                this.applyServerConfusions(attempts);
            },
            error: () => {
                this.metricsOnline = false;
                this.metricsLoading = false;
                this.showToast('Progress service unavailable', 'error');
            },
        });
    }

    @HostListener('document:keydown', ['$event'])
    handleKeyboard(event: KeyboardEvent): void {
        if (this.mobileSetupOpen) {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeMobileSetup();
                return;
            }
            if (event.key === 'Tab') {
                this.trapMobileSetupFocus(event);
                return;
            }
        }
        const target = event.target as HTMLElement;
        const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
        const isInteractive = isTyping || ['BUTTON', 'A'].includes(target.tagName);
        if (isInteractive) {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') this.checkCopy();
            return;
        }
        if (event.code === 'Space') {
            event.preventDefault();
            this.isPlaying ? this.pause() : this.play();
        } else if (event.key.toLowerCase() === 'n') {
            this.newExercise();
        }
    }

    ngOnDestroy(): void {
        this.stop();
        if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
        void this.audioContext?.close();
    }

    private resetExercise(): void {
        this.stop();
        this.exercise = '';
        this.exerciseContext = '';
        this.copy = '';
        this.hasChecked = false;
        this.answerRevealed = false;
        this.revealedGroupCount = 0;
        this.expectedMarks = [];
        this.copyMarks = [];
    }

    private applyExerciseFormat(format: ExerciseFormat): void {
        this.exerciseFormat = format;
        if (format === 'instant') {
            this.instantCharacters = true;
            this.timedMinutes = 0;
            this.repeatCount = 1;
        } else if (format === 'continuous') {
            this.instantCharacters = false;
            this.timedMinutes = 1;
        } else if (format === 'groups') {
            this.instantCharacters = false;
            this.timedMinutes = 0;
        } else {
            this.mode = 'qso';
            this.instantCharacters = false;
            this.timedMinutes = 0;
            if (format === 'simulatedQso') this.qsoStage = 'complete';
            else if (this.qsoStage === 'complete') this.qsoStage = 'mixed';
        }
    }

    private generateExercise(): GeneratedExercise {
        let generated: GeneratedExercise;
        if (this.mode === 'callsigns') generated = { text: Array.from({ length: this.groupCount }, () => this.randomCallsign()).join(' '), context: 'Copy the callsigns' };
        else if (this.mode === 'qsoWords') generated = { text: this.generateQsoWords(), context: `${this.wordCategories.find((item) => item.value === this.wordCategory)?.label} drill` };
        else if (this.mode === 'qso') generated = this.randomQsoOver();
        else if (this.mode === 'letters') generated = this.generateLetterExercise();
        else if (this.mode === 'numbers') generated = this.generateNumberExercise();
        else generated = this.generateMixedExercise();

        return this.enforceContentBoundary(generated);
    }

    private enforceContentBoundary(generated: GeneratedExercise): GeneratedExercise {
        if (this.mode !== 'letters') return generated;
        const text = generated.text
            .toUpperCase()
            .replace(/[^A-Z\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return { ...generated, text: text || this.randomGroups('ABCDEFGHIJKLMNOPQRSTUVWXYZ', Math.max(1, this.groupCount)) };
    }

    private generateLetterExercise(): GeneratedExercise {
        const count = this.effectiveGroupCount();
        let pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let context = 'Random letter groups';
        if (this.letterDrill === 'koch') {
            pool = this.kochSequence.slice(0, this.kochLevel);
            context = `Koch progression: ${this.kochLevel} characters`;
        } else if (this.letterDrill === 'trouble') {
            pool = this.troublePair;
            context = `Trouble-pair drill: ${this.troublePair.split('').join(' and ')}`;
        } else if (this.letterDrill === 'confusions') {
            pool = this.confusionPool(true);
            context = this.topConfusions.length ? `Targeted from your confusion history: ${this.confusionLabel(true)}` : 'No letter confusions yet; using a starter pair';
        } else if (this.letterDrill === 'custom') {
            pool = this.customCharacters.replace(/[^A-Z]/g, '') || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            context = `Custom letter set: ${pool}`;
        } else if (this.letterDrill === 'vowels') {
            pool = 'AEIOU';
            context = 'Vowel recognition drill';
        } else if (this.letterDrill === 'consonants') {
            pool = 'BCDFGHJKLMNPQRSTVWXYZ';
            context = 'Consonant recognition drill';
        }

        if (this.instantCharacters) {
            return { text: this.weightedPick(pool), context: 'Instant character: type one answer to continue' };
        }
        if (this.letterDrill === 'combinations') {
            return { text: Array.from({ length: count }, () => this.pickItem(this.commonCombinations)).join(' '), context: 'Common English letter combinations' };
        }
        return { text: this.randomGroups(pool, count), context };
    }

    private generateNumberExercise(): GeneratedExercise {
        const count = this.effectiveGroupCount();
        if (this.instantCharacters) return { text: this.weightedPick('0123456789'), context: 'Instant number: type one answer to continue' };
        const generators: Record<NumberDrill, () => string> = {
            random: () => Array.from({ length: this.groupSize }, () => this.weightedPick('0123456789')).join(''),
            dates: () => `${this.randomInteger(1, 12).toString().padStart(2, '0')}/${this.randomInteger(1, 28).toString().padStart(2, '0')}/${this.randomInteger(2020, 2030)}`,
            times: () => `${this.randomInteger(0, 23).toString().padStart(2, '0')}:${this.randomInteger(0, 59).toString().padStart(2, '0')}`,
            frequencies: () => `${this.pickItem(['3', '7', '10', '14', '18', '21', '24', '28'])}.${this.randomInteger(0, 999).toString().padStart(3, '0')}`,
            rst: () => `5${this.randomInteger(1, 9)}${this.randomInteger(1, 9)}`,
            serials: () => this.randomInteger(1, 9999).toString().padStart(4, '0'),
            coordinates: () => `${this.randomInteger(25, 49)}.${this.randomInteger(0, 999).toString().padStart(3, '0')}N ${this.randomInteger(67, 124)}.${this.randomInteger(0, 999).toString().padStart(3, '0')}W`,
        };
        const labels: Record<NumberDrill, string> = {
            random: 'Random number groups', dates: 'Copy dates', times: 'Copy 24-hour times', frequencies: 'Copy amateur-band frequencies',
            rst: 'Copy RST reports', serials: 'Copy serial numbers', coordinates: 'Copy geographic coordinates',
        };
        return { text: Array.from({ length: count }, generators[this.numberDrill]).join(' '), context: labels[this.numberDrill] };
    }

    private generateMixedExercise(): GeneratedExercise {
        const count = this.effectiveGroupCount();
        const customPool = this.customCharacters || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/?';
        const pool = this.mixedDrill === 'custom' ? customPool : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/?';
        if (this.instantCharacters) return { text: this.weightedPick(pool), context: 'Instant mixed character: type one answer to continue' };
        if (this.mixedDrill === 'confusions') {
            const confusionPool = this.confusionPool(false);
            return { text: this.randomGroups(confusionPool, count), context: this.topConfusions.length ? `Targeted confusion drill: ${this.confusionLabel(false)}` : 'No confusion history yet; using B / 6 and S / H' };
        }
        if (this.mixedDrill === 'radio') {
            const data = Array.from({ length: count }, () => this.pickItem([
                this.randomCallsign(), `RST ${this.pickItem(['599', '579', '559'])}`, `PWR ${this.pickItem(['5W', '20W', '50W', '100W'])}`,
                `${this.pickItem(['7', '14', '21', '28'])}.${this.randomInteger(0, 999).toString().padStart(3, '0')} MHZ`,
                `TEMP ${this.randomInteger(35, 95)}F`, `NR ${this.randomInteger(1, 999).toString().padStart(3, '0')}`,
            ]));
            return { text: data.join(' '), context: 'Realistic callsigns, reports, frequencies, and station data' };
        }
        const text = this.mixedDrill === 'random'
            ? Array.from({ length: count }, () => Array.from({ length: this.groupSize }, () => this.randomMixedCharacter()).join('')).join(' ')
            : this.randomGroups(pool, count);
        return { text, context: this.mixedDrill === 'custom' ? `Custom set: ${pool}` : `Random mixed groups: ${this.mixedLetterPercent}% letters` };
    }

    private generateQsoWords(): string {
        const pool = this.wordCategory === 'all'
            ? [...new Set(Object.values(this.vocabulary).flat())]
            : [...this.vocabulary[this.wordCategory]];
        const weak = this.weakWords.map((item) => item.word).filter((word) => pool.includes(word));
        const reviewCount = Math.min(weak.length, Math.floor(this.groupCount / 2));
        return [...this.randomItems(weak, reviewCount), ...this.randomItems(pool, this.groupCount - reviewCount)].join(' ');
    }

    private randomQsoOver(): GeneratedExercise {
        const p = this.profile;
        const otherCall = this.randomCallsign();
        const name = this.pickItem(['JIM', 'JOHN', 'BOB', 'MIKE', 'ANNE', 'MARY', 'SUE', 'TOM', 'DAVE', 'PAT']);
        const qth = this.pickItem(['FRESNO CA', 'AUSTIN TX', 'TULSA OK', 'DAYTON OH', 'PHOENIX AZ', 'OMAHA NE', 'ALBANY NY']);
        const rst = this.pickItem(['599', '579', '569', '559', '549']);
        const rig = this.pickItem(['IC 7300', 'ELECRAFT K3', 'YAESU FT 891', 'TEN TEC EAGLE']);
        const antenna = this.pickItem(['DIPOLE UP 45 FT', 'EFHW UP 35 FT', 'VERTICAL', 'LOOP UP 30 FT']);
        const power = this.pickItem(['5W', '20W', '50W', '100W']);
        const weather = this.pickItem(['SUNNY', 'RAIN', 'CLOUDY', 'WINDY', 'CLEAR']);
        const temperature = this.pickItem(['45F', '55F', '68F', '75F', '82F']);
        const greeting = this.pickItem(['GM', 'GA', 'GE']);

        const stages: Record<Exclude<QsoStage, 'mixed' | 'complete'>, GeneratedExercise[]> = {
            frequency: [{ text: 'QRL? QRL?', context: 'Before calling CQ: is this frequency in use?' }],
            cq: [{ text: `CQ CQ DE ${otherCall} ${otherCall} K`, context: `${otherCall} is calling CQ using the LICW 2 × 2 format` }],
            answer: [
                { text: `${p.call} DE ${otherCall} ${otherCall} K`, context: `${otherCall} is answering your CQ` },
                { text: `${otherCall} DE ${p.call} ${p.call} K`, context: 'Practice the response used when answering a CQ' },
            ],
            p1: [{ text: `${p.call} DE ${otherCall} ${greeting} ES TNX FER RPRT UR RST ${rst} ${rst} QTH ${qth} ${qth} NAME ${name} ${name} OK HW? AR ${p.call} DE ${otherCall} K`, context: `Protocol 1: copy ${otherCall}’s RST, QTH, and name` }],
            p2: [{ text: `${p.call} DE ${otherCall} OK ${p.name} FB ES TNX FER INFO RIG ${rig} ES PWR ${power} ANT ${antenna} WX ${weather} ES TEMP ${temperature} OK ${p.name} HW? AR ${p.call} DE ${otherCall} K`, context: `Protocol 2: copy ${otherCall}’s station and weather` }],
            p3: [{ text: `${p.call} DE ${otherCall} OK ${p.name} SOLID CPY AGE 55 YRS BEEN HAM FER 25 YRS MY KEY J38 OK ${p.name} HW? AR ${p.call} DE ${otherCall} K`, context: `Protocol 3: copy ${otherCall}’s personal information` }],
            recovery: [
                { text: `QRS PSE QRS PSE ${otherCall} DE ${p.call} KN`, context: 'Request: please send more slowly' },
                { text: `SRI NAME AGN? NAME AGN? ${otherCall} DE ${p.call} KN`, context: 'Request a fill for a missed name' },
                { text: `SRI CALL? CALL? DE ${p.call} K`, context: 'Request a missed callsign' },
                { text: `BK RIG HR IS ${rig} ${rig} BK`, context: 'Quick BK exchange; BK is sent as two letters' },
            ],
            closing: [
                { text: `${p.call} DE ${otherCall} OK ${p.name} TNX FER FB QSO ES HP CUAGN 73 AR ${p.call} DE ${otherCall} TU SK`, context: `${otherCall} begins the ending sequence` },
                { text: `${otherCall} DE ${p.call} TNX FER QSO 73 AR ${otherCall} DE ${p.call} TU SK E E`, context: 'Final response and closing dits' },
            ],
        };

        if (this.qsoStage === 'complete') {
            return {
                context: `Complete practice QSO between ${p.call} and ${otherCall}; BT separates the turns`,
                text: [
                    `CQ CQ DE ${otherCall} ${otherCall} K`,
                    `${otherCall} DE ${p.call} ${p.call} K`,
                    stages.p1[0].text,
                    `${otherCall} DE ${p.call} ${greeting} ES TNX FER RPRT UR RST 579 579 QTH ${p.qth} ${p.qth} NAME ${p.name} ${p.name} OK HW? AR ${otherCall} DE ${p.call} K`,
                    stages.p2[0].text,
                    `${otherCall} DE ${p.call} RIG ${p.rig} ES PWR ${p.power} ANT ${p.antenna} OK HW? AR ${otherCall} DE ${p.call} K`,
                    stages.closing[0].text,
                    `${otherCall} DE ${p.call} TNX FER QSO 73 AR ${otherCall} DE ${p.call} TU SK E E`,
                ].join(' BT '),
            };
        }

        const selectedStage = this.qsoStage === 'mixed'
            ? this.pickItem(Object.keys(stages) as Exclude<QsoStage, 'mixed' | 'complete'>[])
            : this.qsoStage;
        return this.pickItem(stages[selectedStage]);
    }

    private prepareTimeline(): void {
        const baseTimeline = this.buildTimeline();
        const baseDuration = baseTimeline.length
            ? baseTimeline[baseTimeline.length - 1].start + baseTimeline[baseTimeline.length - 1].duration
            : 0;

        this.timeline = [];

        for (let repetition = 0; repetition < this.repeatCount; repetition += 1) {
            const offset =
                this.countdownSeconds
                + this.audioPaddingSeconds
                + repetition * (baseDuration + 1);

            this.timeline.push(
                ...baseTimeline.map((event) => ({
                    start: event.start + offset,
                    duration: event.duration,
                }))
            );
        }

        const lastToneEnd = this.timeline.length
            ? this.timeline[this.timeline.length - 1].start + this.timeline[this.timeline.length - 1].duration
            : 0;

        this.playbackDuration = this.timeline.length
            ? lastToneEnd + this.audioPaddingSeconds
            : 0;

        this.playbackPosition = 0;
    }

    private buildTimeline(): ToneEvent[] {
        const dot = 1.2 / this.wpm;
        const spacingUnit = Math.max(dot, (60 / this.farnsworthWpm - 31 * dot) / 19);
        const events: ToneEvent[] = [];
        let cursor = 0;
        const words = this.exercise.split(' ').filter(Boolean);

        words.forEach((word, wordIndex) => {
            const patterns = this.joinedProsigns.has(word)
                ? [word.split('').map((character) => this.morse[character] ?? '').join('')]
                : word.split('').map((character) => this.morse[character]).filter((pattern): pattern is string => Boolean(pattern));
            patterns.forEach((pattern, characterIndex) => {
                pattern.split('').forEach((symbol, symbolIndex) => {
                    const duration = symbol === '.' ? dot : dot * 3;
                    events.push({ start: cursor, duration });
                    cursor += duration;
                    if (symbolIndex < pattern.length - 1) cursor += dot;
                });
                if (characterIndex < patterns.length - 1) cursor += spacingUnit * 3 * this.spacingVariation();
            });
            if (wordIndex < words.length - 1) cursor += spacingUnit * 7 * this.spacingVariation();
        });
        return events;
    }

    private scheduleNoise(startAt: number, duration: number, destination: AudioNode): void {
        if (!this.audioContext || duration <= 0) return;
        const sampleRate = this.audioContext.sampleRate;
        const noiseDuration = Math.min(duration, 2);
        const buffer = this.audioContext.createBuffer(1, Math.ceil(sampleRate * noiseDuration), sampleRate);
        const data = buffer.getChannelData(0);
        for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
        const source = this.audioContext.createBufferSource();
        const gain = this.audioContext.createGain();
        gain.gain.value = this.audioEffect === 'challenging' ? 0.13 : 0.035;
        source.buffer = buffer;
        source.loop = duration > noiseDuration;
        source.connect(gain);
        gain.connect(destination);
        source.start(startAt);
        source.stop(startAt + duration);
        this.activeSources.push(source);
    }

    private updatePlaybackPosition(): void {
        if (!this.audioContext || !this.isPlaying) return;
        this.playbackPosition = Math.min(this.playbackDuration, this.playbackOffset + Math.max(0, this.audioContext.currentTime - this.playbackStartedAt));
    }

    private finishPlayback(): void {
        this.playbackPosition = this.playbackDuration;
        this.clearPlayback(false);
        this.isPaused = false;
        if (this.revealMode === 'afterPlayback') this.answerRevealed = true;
    }

    private clearPlayback(resetPosition: boolean): void {
        this.activeSources.forEach((source) => {
            try { source.stop(); } catch { /* source already ended */ }
        });
        this.activeSources = [];
        if (this.playbackTimer !== null) window.clearTimeout(this.playbackTimer);
        if (this.progressTimer !== null) window.clearInterval(this.progressTimer);
        this.playbackTimer = null;
        this.progressTimer = null;
        this.isPlaying = false;
        if (resetPosition) {
            this.playbackPosition = 0;
            this.isPaused = false;
        }
    }

    private alignCharacters(expected: string, copied: string): { expected: CharacterMark[]; copied: CharacterMark[]; correct: number; confusions: Record<string, number> } {
        const rows = expected.length + 1;
        const columns = copied.length + 1;
        const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
        for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
        for (let column = 0; column < columns; column += 1) matrix[0][column] = column;
        for (let row = 1; row < rows; row += 1) {
            for (let column = 1; column < columns; column += 1) {
                matrix[row][column] = Math.min(
                    matrix[row - 1][column] + 1,
                    matrix[row][column - 1] + 1,
                    matrix[row - 1][column - 1] + (expected[row - 1] === copied[column - 1] ? 0 : 1),
                );
            }
        }

        const expectedMarks: CharacterMark[] = [];
        const copiedMarks: CharacterMark[] = [];
        let row = expected.length;
        let column = copied.length;
        let correct = 0;
        const confusions: Record<string, number> = {};
        while (row > 0 || column > 0) {
            if (row > 0 && column > 0 && expected[row - 1] === copied[column - 1] && matrix[row][column] === matrix[row - 1][column - 1]) {
                expectedMarks.unshift({ character: expected[row - 1], status: 'correct' });
                copiedMarks.unshift({ character: copied[column - 1], status: 'correct' });
                correct += 1; row -= 1; column -= 1;
            } else if (row > 0 && column > 0 && matrix[row][column] === matrix[row - 1][column - 1] + 1) {
                expectedMarks.unshift({ character: expected[row - 1], status: 'incorrect' });
                copiedMarks.unshift({ character: copied[column - 1], status: 'incorrect' });
                const pair = `${expected[row - 1]}>${copied[column - 1]}`;
                confusions[pair] = (confusions[pair] ?? 0) + 1;
                row -= 1; column -= 1;
            } else if (row > 0 && matrix[row][column] === matrix[row - 1][column] + 1) {
                expectedMarks.unshift({ character: expected[row - 1], status: 'missing' });
                row -= 1;
            } else {
                copiedMarks.unshift({ character: copied[column - 1], status: 'extra' });
                column -= 1;
            }
        }
        return { expected: expectedMarks, copied: copiedMarks, correct, confusions };
    }

    private trackWeakWords(): void {
        if (this.mode !== 'qsoWords') return;
        const expectedWords = this.exercise.split(/\s+/);
        const copiedWords = this.normalize(this.copy).split(/\s+/);
        expectedWords.forEach((word) => {
            if (!copiedWords.includes(word)) this.weakWordCounts[word] = (this.weakWordCounts[word] ?? 0) + 1;
            else if (this.weakWordCounts[word]) this.weakWordCounts[word] = Math.max(0, this.weakWordCounts[word] - 1);
        });
        localStorage.setItem(this.storageKey('weak-words'), JSON.stringify(this.weakWordCounts));
    }

    private trackWeakCharacters(): void {
        if (!this.isBasicMode) return;
        this.expectedMarks.forEach((mark) => {
            if (mark.character === ' ') return;
            if (mark.status === 'incorrect' || mark.status === 'missing') {
                this.weakCharacterCounts[mark.character] = (this.weakCharacterCounts[mark.character] ?? 0) + 1;
            } else if (mark.status === 'correct' && this.weakCharacterCounts[mark.character]) {
                this.weakCharacterCounts[mark.character] = Math.max(0, this.weakCharacterCounts[mark.character] - 1);
            }
        });
        localStorage.setItem(this.storageKey('weak-characters'), JSON.stringify(this.weakCharacterCounts));
    }

    private trackConfusions(confusions: Record<string, number>): void {
        Object.entries(confusions).forEach(([pair, count]) => {
            this.confusionCounts[pair] = (this.confusionCounts[pair] ?? 0) + count;
        });
        localStorage.setItem(this.storageKey('confusions'), JSON.stringify(this.confusionCounts));
    }

    private savePracticeMetric(accuracy: number, correctCharacters: number, totalCharacters: number, confusions: Record<string, number>, revealedBeforeCheck: boolean): void {
        const missedCharacters: Record<string, number> = {};
        const characterScores: Record<string, number> = {};
        const characterAttempts: Record<string, number> = {};
        const characterCorrect: Record<string, number> = {};
        this.expectedMarks.forEach((mark) => {
            if (mark.character === ' ') return;
            characterAttempts[mark.character] = (characterAttempts[mark.character] ?? 0) + 1;
            if (mark.status === 'missing' || mark.status === 'incorrect') {
                missedCharacters[mark.character] = (missedCharacters[mark.character] ?? 0) + 1;
                characterScores[mark.character] = (characterScores[mark.character] ?? 0) + 2;
            } else if (mark.status === 'correct') {
                characterScores[mark.character] = (characterScores[mark.character] ?? 0) - 1;
                characterCorrect[mark.character] = (characterCorrect[mark.character] ?? 0) + 1;
            }
        });

        const attempt: CwPracticeAttempt = {
            operator: this.profile.call.trim() || 'N0CALL',
            mode: this.mode,
            drill: this.currentDrillName(),
            accuracy,
            correctCharacters,
            totalCharacters,
            wpm: this.wpm,
            farnsworthWpm: this.farnsworthWpm,
            durationSeconds: Math.round(this.playbackDuration * 10) / 10,
            missedCharacters,
            characterScores,
            confusions,
            trainingGoal: this.trainingGoal,
            exerciseFormat: this.exerciseFormat,
            audioEffect: this.audioEffect,
            repeatCount: this.repeatCount,
            groupSize: this.groupSize,
            strictSpacing: this.strictSpacing,
            timedMinutes: this.timedMinutes,
            playCount: this.exercisePlayCount,
            revealedBeforeCheck,
            sessionId: this.sessionId,
            characterAttempts,
            characterCorrect,
            missingCount: this.expectedMarks.filter((mark) => mark.status === 'missing').length,
            incorrectCount: this.expectedMarks.filter((mark) => mark.status === 'incorrect').length,
            extraCount: this.copyMarks.filter((mark) => mark.status === 'extra').length,
        };

        this.http.post<CwPracticeAttempt>(`${environment.apiUrl}/cw-practice-attempts`, attempt).subscribe({
            next: () => {
                this.metricsOnline = true;
                this.loadPracticeMetrics();
                this.showToast('Attempt synced', 'success');
            },
            error: () => {
                this.metricsOnline = false;
                const pending = this.readPendingMetrics();
                pending.push(attempt);
                localStorage.setItem(this.storageKey('pending-metrics'), JSON.stringify(pending.slice(-100)));
                this.pendingMetricCount = Math.min(100, pending.length);
                this.showToast('Attempt saved locally and queued', 'info');
            },
        });
    }

    private flushPendingMetrics(): void {
        const pending = this.readPendingMetrics();
        this.pendingMetricCount = pending.length;
        if (!pending.length) return;
        this.http.post<CwPracticeAttempt>(`${environment.apiUrl}/cw-practice-attempts`, pending[0]).subscribe({
            next: () => {
                pending.shift();
                localStorage.setItem(this.storageKey('pending-metrics'), JSON.stringify(pending));
                this.pendingMetricCount = pending.length;
                if (pending.length) this.flushPendingMetrics();
                else this.loadPracticeMetrics();
            },
            error: () => {
                this.metricsOnline = false;
            },
        });
    }

    private readPendingMetrics(): CwPracticeAttempt[] {
        const saved = localStorage.getItem(this.storageKey('pending-metrics'));
        if (!saved) return [];
        try { return JSON.parse(saved) as CwPracticeAttempt[]; } catch { return []; }
    }

    private buildMetricTrends(attempts: CwPracticeAttempt[]): CwTrendSeries[] {
        const seriesGroups = new Map<string, CwPracticeAttempt[]>();
        attempts.forEach((attempt) => {
            const key = `${attempt.mode}|${attempt.drill}`;
            seriesGroups.set(key, [...(seriesGroups.get(key) ?? []), attempt]);
        });

        return [...seriesGroups.values()].map((seriesAttempts) => {
            const sample = seriesAttempts[0];
            const timeline = seriesAttempts
                .slice()
                .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
            const timelinePositions = new Map(timeline.map((attempt, index) => [attempt, index]));
            const traceGroups = new Map<string, CwPracticeAttempt[]>();
            seriesAttempts.forEach((attempt) => {
                const key = `${attempt.wpm}/${attempt.farnsworthWpm}|${this.metricConditionKey(attempt)}`;
                traceGroups.set(key, [...(traceGroups.get(key) ?? []), attempt]);
            });
            const traces = [...traceGroups.entries()]
                .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                .map(([key, traceAttempts], index) => {
                    const values = traceAttempts
                        .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
                        .slice(-24);
                    const totalCharacters = values.reduce((sum, attempt) => sum + attempt.totalCharacters, 0);
                    const correctCharacters = values.reduce((sum, attempt) => sum + attempt.correctCharacters, 0);
                    const points = values.map((attempt) => {
                        const timelineIndex = timelinePositions.get(attempt) ?? 0;
                        const x = timeline.length === 1 ? 150 : timelineIndex * 300 / (timeline.length - 1);
                        return `${x.toFixed(1)},${100 - attempt.accuracy}`;
                    }).join(' ');
                    return {
                        key,
                        label: `${values[0].wpm}/${values[0].farnsworthWpm} WPM`,
                        detail: this.metricConditionLabel(values[0]),
                        color: this.metricColors[index % this.metricColors.length],
                        attempts: values.length,
                        average: Math.round(correctCharacters * 100 / Math.max(1, totalCharacters)),
                        latest: values[values.length - 1].accuracy,
                        points,
                    };
                });
            return {
                mode: sample.mode,
                label: this.modeLabel(sample.mode),
                drill: sample.drill,
                attempts: seriesAttempts.length,
                traces,
            };
        })
            .sort((a, b) => this.latestAttemptTime(seriesGroups.get(`${b.mode}|${b.drill}`) ?? [])
                .localeCompare(this.latestAttemptTime(seriesGroups.get(`${a.mode}|${a.drill}`) ?? [])))
            .slice(0, 12);
    }

    private buildSpeedAccuracySeries(attempts: CwPracticeAttempt[]): CwSpeedSeries[] {
        const seriesGroups = new Map<string, CwPracticeAttempt[]>();
        attempts.forEach((attempt) => {
            const key = `${attempt.mode}|${attempt.drill}`;
            seriesGroups.set(key, [...(seriesGroups.get(key) ?? []), attempt]);
        });

        return [...seriesGroups.values()].map((seriesAttempts) => {
            const sample = seriesAttempts[0];
            const traceGroups = new Map<string, CwPracticeAttempt[]>();
            seriesAttempts.forEach((attempt) => {
                const key = `${attempt.wpm}|${this.metricConditionKey(attempt)}`;
                traceGroups.set(key, [...(traceGroups.get(key) ?? []), attempt]);
            });
            const traces = [...traceGroups.entries()]
                .sort(([, a], [, b]) => a[0].wpm - b[0].wpm)
                .map(([key, traceAttempts], index) => {
                    const characterWpm = traceAttempts[0].wpm;
                    const values = traceAttempts.slice(0, 80);
                    const points = values.map((attempt) => ({
                        x: Math.max(0, Math.min(300, (attempt.farnsworthWpm - 5) * 300 / 35)),
                        y: 100 - attempt.accuracy,
                        accuracy: attempt.accuracy,
                        characterWpm: attempt.wpm,
                        farnsworthWpm: attempt.farnsworthWpm,
                    }));
                    const buckets = new Map<number, CwPracticeAttempt[]>();
                    values.forEach((attempt) => buckets.set(attempt.farnsworthWpm, [...(buckets.get(attempt.farnsworthWpm) ?? []), attempt]));
                    const averagePoints = [...buckets.entries()]
                        .sort(([a], [b]) => a - b)
                        .map(([farnsworthWpm, bucket]) => {
                            const x = Math.max(0, Math.min(300, (farnsworthWpm - 5) * 300 / 35));
                            const total = bucket.reduce((sum, attempt) => sum + attempt.totalCharacters, 0);
                            const correct = bucket.reduce((sum, attempt) => sum + attempt.correctCharacters, 0);
                            const average = correct * 100 / Math.max(1, total);
                            return `${x.toFixed(1)},${(100 - average).toFixed(1)}`;
                        })
                        .join(' ');
                    return {
                        key,
                        label: `${characterWpm} character WPM`,
                        detail: this.metricConditionLabel(traceAttempts[0]),
                        color: this.metricColors[index % this.metricColors.length],
                        attempts: values.length,
                        points,
                        averagePoints,
                    };
                });
            return {
                mode: sample.mode,
                label: this.modeLabel(sample.mode),
                drill: sample.drill,
                attempts: seriesAttempts.length,
                traces,
            };
        })
            .sort((a, b) => this.latestAttemptTime(seriesGroups.get(`${b.mode}|${b.drill}`) ?? [])
                .localeCompare(this.latestAttemptTime(seriesGroups.get(`${a.mode}|${a.drill}`) ?? [])))
            .slice(0, 12);
    }

    private buildProficiencySummaries(attempts: CwPracticeAttempt[]): CwProficiency[] {
        const seriesGroups = new Map<string, CwPracticeAttempt[]>();
        attempts.forEach((attempt) => {
            const key = `${attempt.mode}|${attempt.drill}`;
            seriesGroups.set(key, [...(seriesGroups.get(key) ?? []), attempt]);
        });

        return [...seriesGroups.values()].map((seriesAttempts) => {
            const sample = seriesAttempts[0];
            const characterSpeedGroups = new Map<string, CwPracticeAttempt[]>();
            seriesAttempts.forEach((attempt) => {
                const key = `${attempt.wpm}|${this.metricConditionKey(attempt)}`;
                characterSpeedGroups.set(key, [...(characterSpeedGroups.get(key) ?? []), attempt]);
            });
            const speeds = [...characterSpeedGroups.entries()]
                .sort(([, a], [, b]) => a[0].wpm - b[0].wpm)
                .map(([key, speedAttempts]) => {
                    const characterWpm = speedAttempts[0].wpm;
                    const farnsworthGroups = new Map<number, CwPracticeAttempt[]>();
                    speedAttempts.forEach((attempt) => farnsworthGroups.set(attempt.farnsworthWpm, [...(farnsworthGroups.get(attempt.farnsworthWpm) ?? []), attempt]));
                    const buckets = [...farnsworthGroups.entries()].map(([farnsworthWpm, values]) => {
                        const characters = values.reduce((sum, attempt) => sum + attempt.totalCharacters, 0);
                        const correct = values.reduce((sum, attempt) => sum + attempt.correctCharacters, 0);
                        return { farnsworthWpm, characters, accuracy: Math.round(correct * 100 / Math.max(1, characters)) };
                    });
                    const proven = buckets
                        .filter((bucket) => bucket.characters >= 100 && bucket.accuracy >= 90)
                        .sort((a, b) => b.farnsworthWpm - a.farnsworthWpm)[0];
                    const candidate = buckets
                        .slice()
                        .sort((a, b) => (b.accuracy >= 90 ? 1 : 0) - (a.accuracy >= 90 ? 1 : 0)
                            || b.farnsworthWpm - a.farnsworthWpm
                            || b.accuracy - a.accuracy)[0];
                    return {
                        key,
                        conditionLabel: this.metricConditionLabel(speedAttempts[0]),
                        characterWpm,
                        provenFarnsworthWpm: proven?.farnsworthWpm ?? null,
                        candidateFarnsworthWpm: candidate.farnsworthWpm,
                        candidateAccuracy: candidate.accuracy,
                        candidateCharacters: candidate.characters,
                    };
                });
            return {
                mode: sample.mode,
                label: this.modeLabel(sample.mode),
                drill: sample.drill,
                speeds,
            };
        })
            .sort((a, b) => this.latestAttemptTime(seriesGroups.get(`${b.mode}|${b.drill}`) ?? [])
                .localeCompare(this.latestAttemptTime(seriesGroups.get(`${a.mode}|${a.drill}`) ?? [])))
            .slice(0, 12);
    }

    private modeLabel(mode: PracticeMode): string {
        return this.modes.find((item) => item.value === mode)?.label ?? mode;
    }

    private metricConditionKey(attempt: CwPracticeAttempt): string {
        if (!attempt.exerciseFormat && !attempt.audioEffect && !attempt.trainingGoal) return 'legacy';
        const basicMode = attempt.mode === 'letters' || attempt.mode === 'numbers' || attempt.mode === 'mixed';
        return [
            attempt.trainingGoal ?? 'unknown-goal',
            attempt.exerciseFormat ?? 'unknown-format',
            attempt.audioEffect ?? 'unknown-audio',
            attempt.exerciseFormat === 'instant' ? 'na' : attempt.repeatCount ?? 'unknown-repeats',
            basicMode && attempt.exerciseFormat !== 'instant' ? attempt.groupSize ?? 'unknown-group' : 'na',
            attempt.strictSpacing === null || attempt.strictSpacing === undefined ? 'unknown-spacing' : attempt.strictSpacing,
            attempt.exerciseFormat === 'continuous' ? attempt.timedMinutes ?? 'unknown-duration' : 'na',
        ].join('|');
    }

    private currentMetricConditionKey(): string {
        const basicMode = this.mode === 'letters' || this.mode === 'numbers' || this.mode === 'mixed';
        return [
            this.trainingGoal,
            this.exerciseFormat,
            this.audioEffect,
            this.exerciseFormat === 'instant' ? 'na' : this.repeatCount,
            basicMode && this.exerciseFormat !== 'instant' ? this.groupSize : 'na',
            this.strictSpacing,
            this.exerciseFormat === 'continuous' ? this.timedMinutes : 'na',
        ].join('|');
    }

    private metricConditionLabel(attempt: CwPracticeAttempt): string {
        if (this.metricConditionKey(attempt) === 'legacy') return 'legacy conditions';
        const goal = this.trainingGoals.find((item) => item.value === attempt.trainingGoal)?.label ?? attempt.trainingGoal ?? 'Unknown goal';
        const format = this.exerciseFormats.find((item) => item.value === attempt.exerciseFormat)?.label ?? attempt.exerciseFormat ?? 'Unknown format';
        const conditions = [goal, format, attempt.audioEffect ?? 'unknown audio'];
        const basicMode = attempt.mode === 'letters' || attempt.mode === 'numbers' || attempt.mode === 'mixed';
        if (basicMode && attempt.exerciseFormat !== 'instant' && attempt.groupSize) conditions.push(`groups of ${attempt.groupSize}`);
        if (attempt.exerciseFormat === 'continuous' && attempt.timedMinutes) conditions.push(`${attempt.timedMinutes} min`);
        if ((attempt.repeatCount ?? 1) > 1) conditions.push(`×${attempt.repeatCount}`);
        if (attempt.strictSpacing) conditions.push('spaces scored');
        return conditions.join(' · ');
    }

    private latestAttemptTime(attempts: CwPracticeAttempt[]): string {
        return attempts.reduce((latest, attempt) => (attempt.createdAt ?? '') > latest ? (attempt.createdAt ?? '') : latest, '');
    }

    private metricTraceKey(chart: 'trend' | 'speed', mode: PracticeMode, drill: string, traceKey: string): string {
        return `${chart}|${mode}|${drill}|${traceKey}`;
    }

    private markPresetModified(): void {
        if (this.activePreset) this.presetModified = true;
        window.setTimeout(() => this.persistUiState(), 0);
    }

    private initializeOperatorState(): void {
        const legacyProfile = this.readLocalJson<Partial<StationProfile>>('cw-copy-profile');
        const initialOperator = this.sanitizeOperator(
            localStorage.getItem('cw-copy-active-operator') ?? legacyProfile?.call ?? this.profile.call,
        ) || 'N0CALL';

        this.migrateLegacyOperatorState(initialOperator);
        this.loadOperatorState(initialOperator);
    }

    private loadServerOperator(operator: string): void {
        const callsign = this.sanitizeOperator(operator);
        if (!callsign) return;
        this.http.get<CwOperatorProfile>(`${environment.apiUrl}/cw-operators/${encodeURIComponent(callsign)}`).subscribe({
            next: (serverProfile) => {
                const serverCallsign = this.sanitizeOperator(serverProfile.callsign) || callsign;
                if (serverCallsign !== this.activeOperator) return;
                this.profile = {
                    call: serverCallsign,
                    name: this.normalize(serverProfile.name),
                    qth: this.normalize(serverProfile.qth),
                    rig: this.normalize(serverProfile.rig),
                    antenna: this.normalize(serverProfile.antenna),
                    power: this.normalize(serverProfile.power),
                };
                const hasLocalUiState = Boolean(localStorage.getItem(this.storageKey('ui')));
                if (serverProfile.settings && !hasLocalUiState) this.applyUiState(serverProfile.settings);
                localStorage.setItem(this.storageKey('profile'), JSON.stringify(this.profile));
                this.persistUiState();
                this.profileSaved = true;
            },
            error: () => {
                /* Fresh callsigns stay local until the user saves them. */
            },
        });
    }

    private saveServerOperator(showSuccessToast: boolean): void {
        const callsign = this.sanitizeOperator(this.profile.call) || this.activeOperator;
        const payload: CwOperatorProfile = {
            callsign,
            name: this.profile.name,
            qth: this.profile.qth,
            rig: this.profile.rig,
            antenna: this.profile.antenna,
            power: this.profile.power,
            settings: this.currentUiState(),
        };
        this.http.put<CwOperatorProfile>(`${environment.apiUrl}/cw-operators/${encodeURIComponent(callsign)}`, payload).subscribe({
            next: (serverProfile) => {
                const serverCallsign = this.sanitizeOperator(serverProfile.callsign) || callsign;
                this.activeOperator = serverCallsign;
                this.profile = {
                    call: serverCallsign,
                    name: this.normalize(serverProfile.name),
                    qth: this.normalize(serverProfile.qth),
                    rig: this.normalize(serverProfile.rig),
                    antenna: this.normalize(serverProfile.antenna),
                    power: this.normalize(serverProfile.power),
                };
                localStorage.setItem('cw-copy-active-operator', serverCallsign);
                localStorage.setItem(this.storageKey('profile'), JSON.stringify(this.profile));
                this.persistUiState();
                this.profileSaved = true;
                if (showSuccessToast) this.showToast('Operator profile synced', 'success');
            },
            error: () => {
                if (showSuccessToast) this.showToast('Operator saved locally; sync unavailable', 'info');
            },
        });
    }

    private loadOperatorState(operator: string): void {
        this.resetLocalStateDefaults();
        this.activeOperator = this.sanitizeOperator(operator) || 'N0CALL';
        localStorage.setItem('cw-copy-active-operator', this.activeOperator);

        const savedProfile = this.readLocalJson<Partial<StationProfile>>(this.storageKey('profile'));
        this.profile = { ...this.defaultProfile(this.activeOperator), ...(savedProfile ?? {}), call: this.activeOperator };
        this.profileSaved = true;
        this.weakWordCounts = this.readLocalJson<Record<string, number>>(this.storageKey('weak-words')) ?? {};
        this.weakCharacterCounts = this.readLocalJson<Record<string, number>>(this.storageKey('weak-characters')) ?? {};
        this.confusionCounts = this.readLocalJson<Record<string, number>>(this.storageKey('confusions')) ?? {};
        this.applyUiState(this.readLocalJson<Partial<CwUiState>>(this.storageKey('ui')) ?? null);
        this.pendingMetricCount = this.readPendingMetrics().length;
    }

    private resetLocalStateDefaults(): void {
        this.mode = 'letters';
        this.trainingGoal = 'accuracy';
        this.exerciseFormat = 'groups';
        this.activePreset = null;
        this.presetModified = false;
        this.activeWorkspace = 'practice';
        this.mobileSetupOpen = false;
        this.showAllMetricConditions = false;
        this.sessionTargetAttempts = 10;
        this.selectedMetricPoint = '';
        this.settingsSections = { advanced: false, content: true, speed: true, audio: false, timing: false, scoring: false };
        this.qsoStage = 'mixed';
        this.wordCategory = 'all';
        this.audioEffect = 'clean';
        this.wpm = 17;
        this.farnsworthWpm = 7;
        this.tone = 550;
        this.groupSize = 5;
        this.groupCount = 5;
        this.letterDrill = 'random';
        this.numberDrill = 'random';
        this.mixedDrill = 'random';
        this.mixedLetterPercent = 60;
        this.kochLevel = 26;
        this.troublePair = 'SH';
        this.customCharacters = 'ABCDE12345';
        this.adaptiveCharacters = false;
        this.adaptiveSpeed = false;
        this.instantCharacters = false;
        this.strictSpacing = true;
        this.repeatCount = 1;
        this.countdownSeconds = 0;
        this.timedMinutes = 0;
        this.revealMode = 'check';
        this.practiceAttempts = [];
        this.metricTrends = [];
        this.speedAccuracySeries = [];
        this.proficiencySummaries = [];
        this.hiddenMetricTraces = new Set<string>();
    }

    private applyUiState(ui: Partial<CwUiState> | null): void {
        if (!ui) return;
        if (ui.activeWorkspace) this.activeWorkspace = ui.activeWorkspace;
        if (typeof ui.showAllMetricConditions === 'boolean') this.showAllMetricConditions = ui.showAllMetricConditions;
        if (ui.trainingGoal) this.trainingGoal = ui.trainingGoal;
        if (ui.mode) this.mode = ui.mode;
        if (ui.exerciseFormat) this.exerciseFormat = ui.exerciseFormat;
        if (ui.activePreset !== undefined) this.activePreset = ui.activePreset;
        if (ui.wpm) this.wpm = ui.wpm;
        if (ui.farnsworthWpm) this.farnsworthWpm = Math.min(ui.farnsworthWpm, this.wpm);
        if (ui.audioEffect) this.audioEffect = ui.audioEffect;
        if (ui.groupSize) this.groupSize = ui.groupSize;
        if (ui.groupCount) this.groupCount = ui.groupCount;
        if (ui.sessionTargetAttempts) this.sessionTargetAttempts = ui.sessionTargetAttempts;
        if (ui.tone) this.tone = ui.tone;
        if (ui.repeatCount) this.repeatCount = ui.repeatCount;
        if (ui.countdownSeconds !== undefined) this.countdownSeconds = ui.countdownSeconds;
        if (ui.timedMinutes !== undefined) this.timedMinutes = ui.timedMinutes;
        if ((ui.uiStateVersion ?? 1) >= 2 && typeof ui.strictSpacing === 'boolean') this.strictSpacing = ui.strictSpacing;
        if (typeof ui.adaptiveCharacters === 'boolean') this.adaptiveCharacters = ui.adaptiveCharacters;
        if (typeof ui.adaptiveSpeed === 'boolean') this.adaptiveSpeed = ui.adaptiveSpeed;
        if (ui.revealMode) this.revealMode = ui.revealMode;
        if (ui.letterDrill) this.letterDrill = ui.letterDrill;
        if (ui.numberDrill) this.numberDrill = ui.numberDrill;
        if (ui.mixedDrill) this.mixedDrill = ui.mixedDrill;
        if (ui.qsoStage) this.qsoStage = ui.qsoStage;
        if (ui.wordCategory) this.wordCategory = ui.wordCategory;
        if (ui.settingsSections) this.settingsSections = { ...this.settingsSections, ...ui.settingsSections };
    }

    private migrateLegacyOperatorState(operator: string): void {
        const mappings = [
            ['cw-copy-profile', this.storageKeyFor(operator, 'profile')],
            ['cw-copy-ui', this.storageKeyFor(operator, 'ui')],
            ['cw-copy-weak-words', this.storageKeyFor(operator, 'weak-words')],
            ['cw-copy-weak-characters', this.storageKeyFor(operator, 'weak-characters')],
            ['cw-copy-confusions', this.storageKeyFor(operator, 'confusions')],
            ['cw-pending-metrics', this.storageKeyFor(operator, 'pending-metrics')],
        ] as const;
        mappings.forEach(([legacyKey, scopedKey]) => {
            const legacyValue = localStorage.getItem(legacyKey);
            if (legacyValue && !localStorage.getItem(scopedKey)) localStorage.setItem(scopedKey, legacyValue);
        });
    }

    private sanitizeOperator(operator: string | null | undefined): string {
        return this.normalize(operator ?? '').replace(/[^A-Z0-9/]/g, '').slice(0, 16);
    }

    private defaultProfile(call: string): StationProfile {
        if (call === 'AF0FR') {
            return {
                call: 'AF0FR',
                name: 'TAYLOR',
                qth: 'OAKVILLE MO',
                rig: 'XIEGU G90',
                antenna: 'EFHW',
                power: '20W',
            };
        }
        return { call, name: '', qth: '', rig: '', antenna: '', power: '' };
    }

    private storageKey(key: string): string {
        return this.storageKeyFor(this.activeOperator, key);
    }

    private storageKeyFor(operator: string, key: string): string {
        return `cw-copy:${this.sanitizeOperator(operator) || 'N0CALL'}:${key}`;
    }

    private readLocalJson<T>(key: string): T | null {
        const saved = localStorage.getItem(key);
        if (!saved) return null;
        try { return JSON.parse(saved) as T; } catch { return null; }
    }

    private currentUiState(): CwUiState {
        return {
            uiStateVersion: this.uiStateVersion,
            activeWorkspace: this.activeWorkspace,
            showAllMetricConditions: this.showAllMetricConditions,
            trainingGoal: this.trainingGoal,
            mode: this.mode,
            exerciseFormat: this.exerciseFormat,
            activePreset: this.activePreset,
            wpm: this.wpm,
            farnsworthWpm: this.farnsworthWpm,
            audioEffect: this.audioEffect,
            groupSize: this.groupSize,
            groupCount: this.groupCount,
            sessionTargetAttempts: this.sessionTargetAttempts,
            tone: this.tone,
            repeatCount: this.repeatCount,
            countdownSeconds: this.countdownSeconds,
            timedMinutes: this.timedMinutes,
            strictSpacing: this.strictSpacing,
            adaptiveCharacters: this.adaptiveCharacters,
            adaptiveSpeed: this.adaptiveSpeed,
            revealMode: this.revealMode,
            letterDrill: this.letterDrill,
            numberDrill: this.numberDrill,
            mixedDrill: this.mixedDrill,
            qsoStage: this.qsoStage,
            wordCategory: this.wordCategory,
            settingsSections: this.settingsSections,
        };
    }

    private persistUiState(): void {
        localStorage.setItem(this.storageKey('ui'), JSON.stringify(this.currentUiState()));
    }

    private showToast(message: string, tone: ToastTone): void {
        this.toastMessage = message;
        this.toastTone = tone;
        if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => {
            this.toastMessage = '';
            this.toastTimer = null;
        }, 2800);
    }

    private roundMetric(value: number): number {
        return Math.round(value * 10) / 10;
    }

    private wilsonInterval(correct: number, total: number): [number, number] {
        if (!total) return [0, 0];
        const z = 1.96;
        const proportion = correct / total;
        const denominator = 1 + z ** 2 / total;
        const center = (proportion + z ** 2 / (2 * total)) / denominator;
        const margin = z * Math.sqrt((proportion * (1 - proportion) + z ** 2 / (4 * total)) / total) / denominator;
        return [Math.max(0, (center - margin) * 100), Math.min(100, (center + margin) * 100)];
    }

    private createSessionId(): string {
        return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    private trapMobileSetupFocus(event: KeyboardEvent): void {
        const drawer = this.mobileSetupDrawer?.nativeElement;
        if (!drawer) return;
        const controls = Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
            .filter((control) => control.offsetParent !== null);
        if (!controls.length) {
            event.preventDefault();
            drawer.focus();
            return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !drawer.contains(active))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (active === last || !drawer.contains(active))) {
            event.preventDefault();
            first.focus();
        }
    }

    private applyServerCharacterScores(attempts: CwPracticeAttempt[]): void {
        const scores: Record<string, number> = {};
        attempts
            .slice()
            .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
            .forEach((attempt) => {
                Object.entries(attempt.characterScores ?? {}).forEach(([character, delta]) => {
                    scores[character] = Math.max(0, (scores[character] ?? 0) + delta);
                });
        });
        this.weakCharacterCounts = scores;
        localStorage.setItem(this.storageKey('weak-characters'), JSON.stringify(scores));
    }

    private applyServerConfusions(attempts: CwPracticeAttempt[]): void {
        const confusions: Record<string, number> = {};
        attempts.slice(0, 100).forEach((attempt) => {
            Object.entries(attempt.confusions ?? {}).forEach(([pair, count]) => {
                confusions[pair] = (confusions[pair] ?? 0) + count;
            });
        });
        this.confusionCounts = confusions;
        localStorage.setItem(this.storageKey('confusions'), JSON.stringify(confusions));
    }

    private currentDrillName(): string {
        if (this.mode === 'letters') return this.letterDrill;
        if (this.mode === 'numbers') return this.numberDrill;
        if (this.mode === 'mixed') return this.mixedDrill;
        if (this.mode === 'qsoWords') return this.wordCategory;
        if (this.mode === 'qso') return this.qsoStage;
        return 'callsigns';
    }

    private adjustAdaptiveSpeed(score: number): void {
        if (score >= 90) {
            if (this.farnsworthWpm < this.wpm) this.farnsworthWpm += 1;
            else if (this.wpm < 40) this.wpm += 1;
        } else if (score < 70) {
            if (this.farnsworthWpm > 5) this.farnsworthWpm -= 1;
            else if (this.wpm > 5) this.wpm -= 1;
        }
    }

    private effectiveGroupCount(): number {
        if (this.instantCharacters) return 1;
        return this.timedMinutes > 0
            ? Math.max(1, Math.round(this.farnsworthWpm * this.timedMinutes * 5 / this.groupSize))
            : this.groupCount;
    }

    private randomGroups(pool: string, count: number): string {
        return Array.from({ length: count }, () => Array.from({ length: this.groupSize }, () => this.weightedPick(pool)).join('')).join(' ');
    }

    private weightedPick(pool: string): string {
        if (this.adaptiveCharacters) {
            const weakPool = pool.split('').flatMap((character) => Array(Math.min(5, this.weakCharacterCounts[character] ?? 0)).fill(character));
            if (weakPool.length && Math.random() < 0.55) return this.pickItem(weakPool);
        }
        return this.pick(pool);
    }

    private randomInteger(minimum: number, maximum: number): number {
        return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
    }

    private randomMixedCharacter(): string {
        return Math.random() * 100 < this.mixedLetterPercent
            ? this.weightedPick('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
            : this.weightedPick('0123456789/?');
    }

    private confusionPool(lettersOnly: boolean): string {
        const characters = this.topConfusions
            .filter((item) => !lettersOnly || (/^[A-Z]$/.test(item.expected) && /^[A-Z]$/.test(item.copied)))
            .slice(0, 4)
            .flatMap((item) => [item.expected, item.copied])
            .filter((character) => Boolean(this.morse[character]));
        return [...new Set(characters)].join('') || (lettersOnly ? this.troublePair : 'B6SH');
    }

    private confusionLabel(lettersOnly: boolean): string {
        const pairs = this.topConfusions
            .filter((item) => !lettersOnly || (/^[A-Z]$/.test(item.expected) && /^[A-Z]$/.test(item.copied)))
            .slice(0, 4)
            .map((item) => `${item.expected}→${item.copied}`);
        return pairs.join(', ') || (lettersOnly ? this.troublePair.split('').join(' / ') : 'B→6, S→H');
    }

    private randomCallsign(): string {
        const prefixes = ['K', 'N', 'W', 'AA', 'AB', 'AF', 'KA', 'KB', 'KC', 'KD', 'KE', 'KF', 'KG', 'KI', 'KJ', 'KK'];
        const suffixLength = 1 + Math.floor(Math.random() * 3);
        return `${this.pickItem(prefixes)}${this.pick('0123456789')}${Array.from({ length: suffixLength }, () => this.pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).join('')}`;
    }

    private spacingVariation(): number {
        if (this.audioEffect === 'clean') return 1;
        const range = this.audioEffect === 'light' ? 0.1 : 0.25;
        return 1 - range + Math.random() * range * 2;
    }

    private randomItems<T>(items: readonly T[], count: number): T[] {
        const shuffled = [...items];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const target = Math.floor(Math.random() * (index + 1));
            [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
        }
        return shuffled.slice(0, count);
    }

    private pickItem<T>(items: readonly T[]): T {
        return items[Math.floor(Math.random() * items.length)];
    }

    private pick(characters: string): string {
        return characters[Math.floor(Math.random() * characters.length)];
    }

    private normalize(value: string): string {
        return value.toUpperCase().trim().replace(/\s+/g, ' ');
    }
}
