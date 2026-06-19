import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';

type PracticeMode = 'letters' | 'numbers' | 'mixed' | 'callsigns' | 'qsoWords' | 'qso';
type QsoStage = 'mixed' | 'frequency' | 'cq' | 'answer' | 'p1' | 'p2' | 'p3' | 'recovery' | 'closing' | 'complete';
type WordCategory = 'all' | 'core' | 'prosigns' | 'qsignals' | 'abbreviations' | 'recovery' | 'ragchew';
type AudioEffect = 'clean' | 'light' | 'challenging';
type MarkStatus = 'correct' | 'incorrect' | 'missing' | 'extra';

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
}

interface StationProfile {
    call: string;
    name: string;
    qth: string;
    rig: string;
    antenna: string;
    power: string;
}

interface ToneEvent {
    start: number;
    duration: number;
}

interface GeneratedExercise {
    text: string;
    context: string;
}

@Component({
    standalone: true,
    imports: [CommonModule],
    templateUrl: './af0fr_cw_qso.page.html',
})
export class Af0frCwQsoPage implements OnDestroy {
    @ViewChild('copyInput') copyInput?: ElementRef<HTMLTextAreaElement>;

    mode: PracticeMode = 'letters';
    qsoStage: QsoStage = 'mixed';
    wordCategory: WordCategory = 'all';
    audioEffect: AudioEffect = 'clean';
    wpm = 15;
    farnsworthWpm = 10;
    tone = 600;
    groupSize = 5;
    groupCount = 5;

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

    profile: StationProfile = {
        call: 'AF0FR',
        name: 'TAYLOR',
        qth: 'OAKVILLE MO',
        rig: 'XIEGU G90',
        antenna: 'EFHW',
        power: '20W',
    };

    readonly modes: { value: PracticeMode; label: string; description: string }[] = [
        { value: 'letters', label: 'Letters', description: 'A–Z character groups' },
        { value: 'numbers', label: 'Numbers', description: '0–9 number groups' },
        { value: 'mixed', label: 'Mixed', description: 'Letters, numbers, / and ?' },
        { value: 'callsigns', label: 'Callsigns', description: 'Realistic amateur call patterns' },
        { value: 'qsoWords', label: 'QSO Words', description: 'Prosigns, Q signals, and abbreviations' },
        { value: 'qso', label: 'QSO', description: 'Guided LICW-style on-air traffic' },
    ];

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

    private audioContext: AudioContext | null = null;
    private activeSources: AudioScheduledSourceNode[] = [];
    private playbackTimer: number | null = null;
    private progressTimer: number | null = null;
    private playbackStartedAt = 0;
    private playbackOffset = 0;
    private timeline: ToneEvent[] = [];

    private readonly morse: Record<string, string> = {
        A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
        H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
        O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
        V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
        '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
        '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
        '/': '-..-.', '?': '..--..',
    };

    private readonly joinedProsigns = new Set(['AR', 'AS', 'BT', 'KN', 'SK']);

    constructor() {
        const savedProfile = localStorage.getItem('cw-copy-profile');
        const savedWeakWords = localStorage.getItem('cw-copy-weak-words');
        if (savedProfile) {
            try { this.profile = { ...this.profile, ...JSON.parse(savedProfile) }; } catch { /* keep defaults */ }
        }
        if (savedWeakWords) {
            try { this.weakWordCounts = JSON.parse(savedWeakWords); } catch { /* start fresh */ }
        }
    }

    get accuracy(): number {
        return this.totalCharacters ? Math.round((this.correctCharacters / this.totalCharacters) * 100) : 0;
    }

    get history(): CopyResult[] {
        return this.results.slice(0, 5);
    }

    get progressPercent(): number {
        return this.playbackDuration ? Math.min(100, (this.playbackPosition / this.playbackDuration) * 100) : 0;
    }

    get secondsRemaining(): number {
        return Math.max(0, Math.ceil(this.playbackDuration - this.playbackPosition));
    }

    get weakWords(): { word: string; misses: number }[] {
        return Object.entries(this.weakWordCounts)
            .filter(([, misses]) => misses > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([word, misses]) => ({ word, misses }));
    }

    get activeProsigns(): { token: string; meaning: string }[] {
        const tokens = new Set(this.exercise.split(/\s+/));
        return this.prosignGlossary.filter((item) => tokens.has(item.token));
    }

    selectMode(mode: PracticeMode): void {
        this.mode = mode;
        this.resetExercise();
    }

    selectQsoStage(stage: string): void {
        this.qsoStage = stage as QsoStage;
        this.resetExercise();
    }

    selectWordCategory(category: string): void {
        this.wordCategory = category as WordCategory;
        this.resetExercise();
    }

    selectAudioEffect(effect: string): void {
        this.audioEffect = effect as AudioEffect;
        this.stop();
        if (this.exercise) this.prepareTimeline();
    }

    updateProfile(field: keyof StationProfile, value: string): void {
        this.profile = { ...this.profile, [field]: this.normalize(value) };
        this.profileSaved = false;
    }

    saveProfile(): void {
        localStorage.setItem('cw-copy-profile', JSON.stringify(this.profile));
        this.profileSaved = true;
        this.resetExercise();
    }

    updateNumber(setting: 'wpm' | 'farnsworthWpm' | 'tone' | 'groupSize' | 'groupCount', value: string): void {
        const ranges = {
            wpm: [5, 40], farnsworthWpm: [5, this.wpm], tone: [350, 900],
            groupSize: [1, 8], groupCount: [1, 10],
        } as const;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;
        const [minimum, maximum] = ranges[setting];
        this[setting] = Math.min(maximum, Math.max(minimum, parsed));
        if (setting === 'wpm' && this.farnsworthWpm > this.wpm) this.farnsworthWpm = this.wpm;
        if (setting === 'groupSize' || setting === 'groupCount') this.resetExercise();
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
        this.expectedMarks = [];
        this.copyMarks = [];
        this.prepareTimeline();
        window.setTimeout(() => this.copyInput?.nativeElement.focus(), 0);
        if (playImmediately) this.play();
    }

    play(): void {
        if (!this.exercise) this.newExercise(false);
        if (this.playbackPosition >= this.playbackDuration) this.playbackPosition = 0;
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
        this.progressTimer = window.setInterval(() => this.updatePlaybackPosition(), 50);
        this.playbackTimer = window.setTimeout(() => this.finishPlayback(), Math.max(0, (this.playbackDuration - offset + 0.1) * 1000));
    }

    pause(): void {
        if (!this.isPlaying) return;
        this.updatePlaybackPosition();
        this.clearPlayback(false);
        this.isPaused = true;
    }

    stop(): void {
        this.clearPlayback(true);
    }

    onCopyInput(value: string): void {
        this.copy = value.toUpperCase();
        this.hasChecked = false;
    }

    checkCopy(): void {
        if (!this.exercise || !this.copy.trim()) return;
        this.stop();
        const expected = this.exercise.replace(/\s+/g, '');
        const copied = this.normalize(this.copy).replaceAll(' ', '');
        const comparison = this.alignCharacters(expected, copied);
        const denominator = Math.max(expected.length, copied.length, 1);
        const exerciseAccuracy = Math.round((comparison.correct / denominator) * 100);

        this.expectedMarks = comparison.expected;
        this.copyMarks = comparison.copied;
        this.correctCharacters += comparison.correct;
        this.totalCharacters += denominator;
        this.attempts += 1;
        this.hasChecked = true;
        this.trackWeakWords();
        this.results = [{
            expected: this.exercise,
            copied: this.normalize(this.copy),
            accuracy: exerciseAccuracy,
            correct: exerciseAccuracy === 100,
            mode: this.modes.find((item) => item.value === this.mode)?.label ?? this.mode,
            detail: this.mode === 'qso' ? this.qsoStages.find((item) => item.value === this.qsoStage)?.label ?? '' : this.mode === 'qsoWords' ? this.wordCategories.find((item) => item.value === this.wordCategory)?.label ?? '' : '',
            wpm: this.wpm,
            farnsworthWpm: this.farnsworthWpm,
        }, ...this.results];
    }

    resetSession(): void {
        this.stop();
        this.exercise = '';
        this.exerciseContext = '';
        this.copy = '';
        this.hasChecked = false;
        this.expectedMarks = [];
        this.copyMarks = [];
        this.correctCharacters = 0;
        this.totalCharacters = 0;
        this.attempts = 0;
        this.results = [];
    }

    clearWeakWords(): void {
        this.weakWordCounts = {};
        localStorage.removeItem('cw-copy-weak-words');
    }

    @HostListener('document:keydown', ['$event'])
    handleKeyboard(event: KeyboardEvent): void {
        const target = event.target as HTMLElement;
        const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
        if (isTyping) {
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
        void this.audioContext?.close();
    }

    private resetExercise(): void {
        this.stop();
        this.exercise = '';
        this.exerciseContext = '';
        this.copy = '';
        this.hasChecked = false;
        this.expectedMarks = [];
        this.copyMarks = [];
    }

    private generateExercise(): GeneratedExercise {
        if (this.mode === 'callsigns') return { text: Array.from({ length: this.groupCount }, () => this.randomCallsign()).join(' '), context: 'Copy the callsigns' };
        if (this.mode === 'qsoWords') return { text: this.generateQsoWords(), context: `${this.wordCategories.find((item) => item.value === this.wordCategory)?.label} drill` };
        if (this.mode === 'qso') return this.randomQsoOver();

        const pools: Record<'letters' | 'numbers' | 'mixed', string> = {
            letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', numbers: '0123456789', mixed: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/?',
        };
        const pool = pools[this.mode];
        return {
            text: Array.from({ length: this.groupCount }, () => Array.from({ length: this.groupSize }, () => this.pick(pool)).join('')).join(' '),
            context: `Copy ${this.groupCount} groups`,
        };
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
        this.timeline = this.buildTimeline();
        this.playbackDuration = this.timeline.length ? this.timeline[this.timeline.length - 1].start + this.timeline[this.timeline.length - 1].duration : 0;
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

    private alignCharacters(expected: string, copied: string): { expected: CharacterMark[]; copied: CharacterMark[]; correct: number } {
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
        while (row > 0 || column > 0) {
            if (row > 0 && column > 0 && expected[row - 1] === copied[column - 1] && matrix[row][column] === matrix[row - 1][column - 1]) {
                expectedMarks.unshift({ character: expected[row - 1], status: 'correct' });
                copiedMarks.unshift({ character: copied[column - 1], status: 'correct' });
                correct += 1; row -= 1; column -= 1;
            } else if (row > 0 && column > 0 && matrix[row][column] === matrix[row - 1][column - 1] + 1) {
                expectedMarks.unshift({ character: expected[row - 1], status: 'incorrect' });
                copiedMarks.unshift({ character: copied[column - 1], status: 'incorrect' });
                row -= 1; column -= 1;
            } else if (row > 0 && matrix[row][column] === matrix[row - 1][column] + 1) {
                expectedMarks.unshift({ character: expected[row - 1], status: 'missing' });
                row -= 1;
            } else {
                copiedMarks.unshift({ character: copied[column - 1], status: 'extra' });
                column -= 1;
            }
        }
        return { expected: expectedMarks, copied: copiedMarks, correct };
    }

    private trackWeakWords(): void {
        if (this.mode !== 'qsoWords') return;
        const expectedWords = this.exercise.split(/\s+/);
        const copiedWords = this.normalize(this.copy).split(/\s+/);
        expectedWords.forEach((word) => {
            if (!copiedWords.includes(word)) this.weakWordCounts[word] = (this.weakWordCounts[word] ?? 0) + 1;
            else if (this.weakWordCounts[word]) this.weakWordCounts[word] = Math.max(0, this.weakWordCounts[word] - 1);
        });
        localStorage.setItem('cw-copy-weak-words', JSON.stringify(this.weakWordCounts));
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
