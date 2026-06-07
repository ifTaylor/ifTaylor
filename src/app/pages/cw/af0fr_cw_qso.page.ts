import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface CwChunk {
    label: string;
    text: string;
    note?: string;
    morseParts?: string[];
}

interface CwFlowStep {
    title: string;
    send?: string;
    expect?: string;
    note?: string;
    morseParts?: string[];
}

interface MorseRow {
    text: string;
    morse: string;
}

@Component({
    standalone: true,
    imports: [CommonModule],
    templateUrl: './af0fr_cw_qso.page.html',
})
export class Af0frCwQsoPage {
    readonly myCall = 'AF0FR';

    readonly variables: CwChunk[] = [
        { label: 'MYCALL', text: 'AF0FR', note: 'Your callsign' },
        { label: 'THEIRCALL', text: 'K0KXK', note: 'Example other station callsign' },
        { label: 'RST', text: '579', note: 'Example signal report' },
        { label: 'NAME', text: 'TAYLOR', note: 'Your name' },
        { label: 'QTH', text: 'OAKVILLE MO', note: 'Your location' },
        { label: 'RIG', text: 'XIEGU G90', note: 'Your radio' },
        { label: 'ANT', text: 'EFHW', note: 'Your antenna' },
        { label: 'PWR', text: '20W', note: 'Transmit power' },
        { label: 'WX', text: 'CLOUDY 75F', note: 'Weather' },
    ];

    readonly callingCqSteps: CwFlowStep[] = [
        {
            title: 'Check frequency',
            send: 'QRL? DE AF0FR K',
            morseParts: ['QRL?', 'DE', 'AF0FR', 'K'],
            note: 'Send once or twice. If someone replies C, YES, or QRL, move.',
        },
        {
            title: 'Call CQ',
            send: 'CQ CQ CQ DE AF0FR AF0FR AF0FR K',
            morseParts: ['CQ CQ CQ', 'DE', 'AF0FR AF0FR AF0FR', 'K'],
            note: 'Use K because anyone may answer.',
        },
        {
            title: 'They answer',
            expect: 'AF0FR DE THEIRCALL THEIRCALL K',
            morseParts: ['AF0FR', 'DE', 'THEIRCALL THEIRCALL', 'K'],
            note: 'Copy their call before replying.',
        },
        {
            title: 'Your first over',
            send: 'THEIRCALL DE AF0FR GE TNX FER CALL UR RST 579 NAME TAYLOR TAYLOR QTH OAKVILLE MO HW? THEIRCALL DE AF0FR KN',
            morseParts: [
                'THEIRCALL DE AF0FR',
                'GE',
                'TNX FER CALL',
                'UR RST 579',
                'NAME TAYLOR TAYLOR',
                'QTH OAKVILLE MO',
                'HW?',
                'THEIRCALL DE AF0FR KN',
            ],
            note: 'Once in a QSO, use KN to send it back only to that station.',
        },
        {
            title: 'Their first over',
            expect: 'AF0FR DE THEIRCALL UR RST 599 NAME BOB QTH KANSAS CITY MO HW? AF0FR DE THEIRCALL KN',
            morseParts: [
                'AF0FR DE THEIRCALL',
                'UR RST 599',
                'NAME BOB',
                'QTH KANSAS CITY MO',
                'HW?',
                'AF0FR DE THEIRCALL KN',
            ],
        },
        {
            title: 'Your station info',
            send: 'THEIRCALL DE AF0FR FB BOB TNX FER RST RIG XIEGU G90 ANT EFHW PWR 20W WX CLOUDY 75F HW? THEIRCALL DE AF0FR KN',
            morseParts: [
                'THEIRCALL DE AF0FR',
                'FB BOB',
                'TNX FER RST',
                'RIG XIEGU G90',
                'ANT EFHW',
                'PWR 20W',
                'WX CLOUDY 75F',
                'HW?',
                'THEIRCALL DE AF0FR KN',
            ],
        },
        {
            title: 'Their station info / close',
            expect: 'AF0FR DE THEIRCALL RIG IC7300 ANT DIPOLE PWR 100W WX SUNNY TNX QSO 73 AF0FR DE THEIRCALL KN',
            morseParts: [
                'AF0FR DE THEIRCALL',
                'RIG IC7300',
                'ANT DIPOLE',
                'PWR 100W',
                'WX SUNNY',
                'TNX QSO 73',
                'AF0FR DE THEIRCALL KN',
            ],
        },
        {
            title: 'Your final',
            send: 'THEIRCALL DE AF0FR TNX FER NICE QSO 73 ES GL THEIRCALL DE AF0FR SK',
            morseParts: [
                'THEIRCALL DE AF0FR',
                'TNX FER NICE QSO',
                '73 ES GL',
                'THEIRCALL DE AF0FR SK',
            ],
            note: 'SK means final end of contact.',
        },
    ];

    readonly answeringCqSteps: CwFlowStep[] = [
        {
            title: 'Hear their CQ',
            expect: 'CQ CQ CQ DE THEIRCALL THEIRCALL K',
            morseParts: ['CQ CQ CQ', 'DE', 'THEIRCALL THEIRCALL', 'K'],
        },
        {
            title: 'Answer',
            send: 'THEIRCALL DE AF0FR AF0FR K',
            morseParts: ['THEIRCALL', 'DE', 'AF0FR AF0FR', 'K'],
            note: 'If weak, send your call two or three times.',
        },
        {
            title: 'They reply',
            expect: 'AF0FR DE THEIRCALL TNX FER CALL UR RST 599 NAME BOB QTH KANSAS CITY MO HW? AF0FR DE THEIRCALL KN',
            morseParts: [
                'AF0FR DE THEIRCALL',
                'TNX FER CALL',
                'UR RST 599',
                'NAME BOB',
                'QTH KANSAS CITY MO',
                'HW?',
                'AF0FR DE THEIRCALL KN',
            ],
        },
        {
            title: 'Your first over',
            send: 'THEIRCALL DE AF0FR TNX BOB UR RST 579 NAME TAYLOR TAYLOR QTH OAKVILLE MO HW? THEIRCALL DE AF0FR KN',
            morseParts: [
                'THEIRCALL DE AF0FR',
                'TNX BOB',
                'UR RST 579',
                'NAME TAYLOR TAYLOR',
                'QTH OAKVILLE MO',
                'HW?',
                'THEIRCALL DE AF0FR KN',
            ],
        },
        {
            title: 'Their station info',
            expect: 'AF0FR DE THEIRCALL RIG IC7300 ANT DIPOLE PWR 100W WX SUNNY HW? AF0FR DE THEIRCALL KN',
            morseParts: [
                'AF0FR DE THEIRCALL',
                'RIG IC7300',
                'ANT DIPOLE',
                'PWR 100W',
                'WX SUNNY',
                'HW?',
                'AF0FR DE THEIRCALL KN',
            ],
        },
        {
            title: 'Your station info',
            send: 'THEIRCALL DE AF0FR FB BOB RIG XIEGU G90 ANT EFHW PWR 20W WX CLOUDY 75F TNX FER QSO THEIRCALL DE AF0FR KN',
            morseParts: [
                'THEIRCALL DE AF0FR',
                'FB BOB',
                'RIG XIEGU G90',
                'ANT EFHW',
                'PWR 20W',
                'WX CLOUDY 75F',
                'TNX FER QSO',
                'THEIRCALL DE AF0FR KN',
            ],
        },
        {
            title: 'They close',
            expect: 'AF0FR DE THEIRCALL TNX QSO 73 ES GL AF0FR DE THEIRCALL SK',
            morseParts: [
                'AF0FR DE THEIRCALL',
                'TNX QSO',
                '73 ES GL',
                'AF0FR DE THEIRCALL SK',
            ],
        },
        {
            title: 'Your final',
            send: 'THEIRCALL DE AF0FR TNX 73 ES GL THEIRCALL DE AF0FR SK',
            morseParts: [
                'THEIRCALL DE AF0FR',
                'TNX',
                '73 ES GL',
                'THEIRCALL DE AF0FR SK',
            ],
        },
    ];

    readonly openingChunks: CwChunk[] = [
        { label: 'Check frequency', text: 'QRL?' },
        { label: 'Signed QRL', text: 'QRL? DE AF0FR K', morseParts: ['QRL?', 'DE', 'AF0FR', 'K'] },
        { label: 'Call CQ', text: 'CQ CQ CQ DE AF0FR AF0FR AF0FR K', morseParts: ['CQ CQ CQ', 'DE', 'AF0FR AF0FR AF0FR', 'K'] },
        { label: 'Longer CQ', text: 'CQ CQ CQ DE AF0FR AF0FR AF0FR CQ CQ CQ DE AF0FR AF0FR AF0FR K', morseParts: ['CQ CQ CQ', 'DE', 'AF0FR AF0FR AF0FR', 'CQ CQ CQ', 'DE', 'AF0FR AF0FR AF0FR', 'K'] },
        { label: 'Answer CQ', text: 'THEIRCALL DE AF0FR AF0FR K', morseParts: ['THEIRCALL', 'DE', 'AF0FR AF0FR', 'K'] },
        { label: 'Weak signal answer', text: 'THEIRCALL DE AF0FR AF0FR AF0FR K', morseParts: ['THEIRCALL', 'DE', 'AF0FR AF0FR AF0FR', 'K'] },
        { label: 'Thanks for call', text: 'TNX FER CALL', morseParts: ['TNX', 'FER', 'CALL'] },
        { label: 'Greeting', text: 'GM / GA / GE', morseParts: ['GM', 'GA', 'GE'] },
    ];

    readonly exchangeChunks: CwChunk[] = [
        { label: 'Signal report', text: 'UR RST 599', morseParts: ['UR', 'RST', '599'] },
        { label: 'Weaker report', text: 'UR RST 579', morseParts: ['UR', 'RST', '579'] },
        { label: 'Weak report', text: 'UR RST 559', morseParts: ['UR', 'RST', '559'] },
        { label: 'Name', text: 'NAME TAYLOR TAYLOR', morseParts: ['NAME', 'TAYLOR', 'TAYLOR'] },
        { label: 'Location', text: 'QTH OAKVILLE MO', morseParts: ['QTH', 'OAKVILLE', 'MO'] },
        { label: 'How copy?', text: 'HW CPY?', morseParts: ['HW', 'CPY?'] },
        { label: 'Short how copy?', text: 'HW?' },
        { label: 'Good copy', text: 'FB' },
        { label: 'Thanks for report', text: 'TNX FER RST', morseParts: ['TNX', 'FER', 'RST'] },
        { label: 'Back to you only', text: 'THEIRCALL DE AF0FR KN', morseParts: ['THEIRCALL', 'DE', 'AF0FR', 'KN'] },
    ];

    readonly stationChunks: CwChunk[] = [
        { label: 'Rig', text: 'RIG HR XIEGU G90', morseParts: ['RIG', 'HR', 'XIEGU', 'G90'] },
        { label: 'Antenna', text: 'ANT HR EFHW', morseParts: ['ANT', 'HR', 'EFHW'] },
        { label: 'Power', text: 'PWR 20W', morseParts: ['PWR', '20W'] },
        { label: 'QRP', text: 'PWR 5W QRP', morseParts: ['PWR', '5W', 'QRP'] },
        { label: 'Weather', text: 'WX CLOUDY 75F', morseParts: ['WX', 'CLOUDY', '75F'] },
        { label: 'Simple station info', text: 'RIG XIEGU G90 ANT EFHW PWR 20W', morseParts: ['RIG XIEGU G90', 'ANT EFHW', 'PWR 20W'] },
    ];

    readonly closingChunks: CwChunk[] = [
        { label: 'Thanks for QSO', text: 'TNX FER QSO', morseParts: ['TNX', 'FER', 'QSO'] },
        { label: 'Nice QSO', text: 'TNX FER NICE QSO', morseParts: ['TNX', 'FER', 'NICE', 'QSO'] },
        { label: 'Best wishes', text: '73 ES GL', morseParts: ['73', 'ES', 'GL'] },
        { label: 'See you again', text: 'CU AGN', morseParts: ['CU', 'AGN'] },
        { label: 'Hope to meet again', text: 'HPE CU AGN', morseParts: ['HPE', 'CU', 'AGN'] },
        { label: 'Final as caller', text: 'THEIRCALL DE AF0FR TNX FER QSO 73 ES GL THEIRCALL DE AF0FR SK', morseParts: ['THEIRCALL DE AF0FR', 'TNX FER QSO', '73 ES GL', 'THEIRCALL DE AF0FR SK'] },
        { label: 'Final as responder', text: 'THEIRCALL DE AF0FR TNX BOB 73 ES GL THEIRCALL DE AF0FR SK', morseParts: ['THEIRCALL DE AF0FR', 'TNX BOB', '73 ES GL', 'THEIRCALL DE AF0FR SK'] },
    ];

    readonly prosigns: CwChunk[] = [
        { label: 'K', text: 'Over / anyone may answer', note: 'Use for CQ or general calls.' },
        { label: 'KN', text: 'Over to named station only', note: 'Use once the QSO is established.' },
        { label: 'AR', text: 'End of message', note: 'Less common as the main handoff in a normal QSO.' },
        { label: 'SK', text: 'End of contact', note: 'Use at final goodbye.' },
        { label: 'BT', text: 'Break / separator', note: 'Like a paragraph break.' },
        { label: 'AS', text: 'Wait / stand by' },
        { label: 'QRL?', text: 'Is this frequency in use?' },
        { label: 'QTH', text: 'Location' },
        { label: 'RST', text: 'Readability / Strength / Tone' },
        { label: 'DE', text: 'From' },
        { label: 'CQ', text: 'Calling any station' },
        { label: 'TNX', text: 'Thanks' },
        { label: 'FER', text: 'For' },
        { label: 'ES', text: 'And' },
        { label: 'GL', text: 'Good luck' },
    ];

    readonly morseMap: Record<string, string> = {
        A: '.-',
        B: '-...',
        C: '-.-.',
        D: '-..',
        E: '.',
        F: '..-.',
        G: '--.',
        H: '....',
        I: '..',
        J: '.---',
        K: '-.-',
        L: '.-..',
        M: '--',
        N: '-.',
        O: '---',
        P: '.--.',
        Q: '--.-',
        R: '.-.',
        S: '...',
        T: '-',
        U: '..-',
        V: '...-',
        W: '.--',
        X: '-..-',
        Y: '-.--',
        Z: '--..',

        '0': '-----',
        '1': '.----',
        '2': '..---',
        '3': '...--',
        '4': '....-',
        '5': '.....',
        '6': '-....',
        '7': '--...',
        '8': '---..',
        '9': '----.',

        '?': '..--..',
        '/': '-..-.',
        '.': '.-.-.-',
        ',': '--..--',
        ':': '---...',
        '-': '-....-',
        '=': '-...-',
    };

    morseRows(value: string | undefined, parts?: string[]): MorseRow[] {
        if (!value) return [];

        const tokens = parts?.length
            ? parts
            : this.normalizeExample(value)
                .split(/\s+/)
                .filter(Boolean);

        return tokens.map((token) => {
            const normalizedToken = this.normalizeExample(token);

            return {
                text: normalizedToken,
                morse: this.phraseToMorse(normalizedToken),
            };
        });
    }

    toMorse(value: string | undefined): string {
        if (!value) return '';
        return this.phraseToMorse(this.normalizeExample(value));
    }

    private phraseToMorse(value: string): string {
        return value
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => this.wordToMorse(word))
            .join(' / ');
    }

    private wordToMorse(word: string): string {
        return word
            .split('')
            .map((character) => this.morseMap[character] ?? character)
            .join(' ');
    }

    private normalizeExample(value: string): string {
        return value
            .toUpperCase()
            .replaceAll('THEIRCALL', 'K0KXK')
            .replaceAll('NAME', 'BOB')
            .replaceAll('___', '599');
    }
}
