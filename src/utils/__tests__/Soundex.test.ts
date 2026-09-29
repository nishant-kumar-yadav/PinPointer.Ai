import { soundex, soundexAll } from '../Soundex';

describe('soundex — classic phonetic codes', () => {
    it('encodes Robert as R163 (textbook example)', () => {
        expect(soundex('Robert')).toBe('R163');
    });

    it('gives Rupert the same code as Robert (phonetic equivalence)', () => {
        expect(soundex('Rupert')).toBe('R163');
        expect(soundex('Rupert')).toBe(soundex('Robert'));
    });

    it('encodes Ashcraft and Ashcroft identically (A261)', () => {
        expect(soundex('Ashcraft')).toBe('A261');
        expect(soundex('Ashcroft')).toBe('A261');
    });

    it('encodes Pfister as P236', () => {
        expect(soundex('Pfister')).toBe('P236');
    });

    it('encodes Tymczak as T520 (adjacent same-codes collapse)', () => {
        // This implementation never resets the "previous code" on vowels,
        // so K collapses into the earlier C/Z=2 group.
        expect(soundex('Tymczak')).toBe('T520');
    });

    it('encodes Washington as W252, truncating to 4 chars', () => {
        expect(soundex('Washington')).toBe('W252');
    });

    it('matches the docstring examples', () => {
        expect(soundex('aaj')).toBe('A200');
        expect(soundex('aajj')).toBe('A200');
        expect(soundex('aj')).toBe('A200');
        expect(soundex('raam')).toBe('R500');
        expect(soundex('ram')).toBe('R500');
    });
});

describe('soundex — Hindi / Indian names', () => {
    it('encodes Sharma as S650', () => {
        expect(soundex('Sharma')).toBe('S650');
    });

    it('encodes Nishant as N253', () => {
        expect(soundex('Nishant')).toBe('N253');
    });

    it('encodes Kumar as K560', () => {
        expect(soundex('Kumar')).toBe('K560');
    });

    it('encodes Priya as P600', () => {
        expect(soundex('Priya')).toBe('P600');
    });

    it('encodes Singh as S520', () => {
        expect(soundex('Singh')).toBe('S520');
    });

    it('encodes Mohammed as M300 (vowels do not reset the previous code)', () => {
        // M(5) … vowels keep prev=5, so the second M collapses: M + D(3).
        expect(soundex('Mohammed')).toBe('M300');
    });

    it('treats variant spellings of the same name identically', () => {
        expect(soundex('Raam')).toBe(soundex('Ram'));
        expect(soundex('Aaj')).toBe(soundex('Aj'));
    });
});

describe('soundex — normalization and edge cases', () => {
    it('is case-insensitive', () => {
        expect(soundex('ROBERT')).toBe('R163');
        expect(soundex('robert')).toBe('R163');
        expect(soundex('RoBeRt')).toBe('R163');
    });

    it('strips digits and punctuation before coding', () => {
        expect(soundex('A1b2')).toBe('A100');
        expect(soundex('R0b3rt!')).toBe('R163');
        expect(soundex('hello-world')).toBe('H464');
    });

    it('ignores surrounding whitespace', () => {
        expect(soundex('  ram  ')).toBe('R500');
    });

    it('returns empty string for empty input', () => {
        expect(soundex('')).toBe('');
    });

    it('returns empty string when no letters remain after stripping', () => {
        expect(soundex('12345')).toBe('');
        expect(soundex('!@#$%')).toBe('');
        expect(soundex('   ')).toBe('');
        expect(soundex('123 456')).toBe('');
    });

    it('pads short codes with zeros to 4 chars', () => {
        expect(soundex('A')).toBe('A000');
        expect(soundex('z')).toBe('Z000');
        expect(soundex('Jo')).toBe('J000');
        expect(soundex('Li')).toBe('L000');
    });

    it('always returns a 4-char code for any non-empty alphabetic word', () => {
        for (const word of ['a', 'to', 'cat', 'elephant', 'supercalifragilisticexpialidocious']) {
            expect(soundex(word)).toHaveLength(4);
        }
    });

    it('always starts the code with the uppercased first letter', () => {
        expect(soundex('kumar')[0]).toBe('K');
        expect(soundex('sharma')[0]).toBe('S');
    });
});

describe('soundexAll', () => {
    it('encodes each word: "aaj ghar" → ["A200", "G600"]', () => {
        expect(soundexAll('aaj ghar')).toEqual(['A200', 'G600']);
    });

    it('encodes "hello world"', () => {
        expect(soundexAll('hello world')).toEqual(['H400', 'W643']);
    });

    it('returns [] for empty string', () => {
        expect(soundexAll('')).toEqual([]);
    });

    it('returns [] for whitespace-only input', () => {
        expect(soundexAll('   ')).toEqual([]);
        expect(soundexAll('\t\n ')).toEqual([]);
    });

    it('collapses multiple spaces, tabs and newlines', () => {
        expect(soundexAll('aaj   ram')).toEqual(['A200', 'R500']);
        expect(soundexAll('aaj\t\nram')).toEqual(['A200', 'R500']);
        expect(soundexAll('  ram  ')).toEqual(['R500']);
    });

    it('drops words with no letters (they produce no 4-char code)', () => {
        expect(soundexAll('123 456')).toEqual([]);
        expect(soundexAll('aaj 123 ram')).toEqual(['A200', 'R500']);
    });

    it('handles single-character words (no following letters to code)', () => {
        expect(soundexAll('a b')).toEqual(['A000', 'B000']);
    });
});
