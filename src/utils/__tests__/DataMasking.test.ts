import { maskSensitiveData } from '../DataMasking';

describe('maskSensitiveData — Aadhaar (12 digits)', () => {
    it('masks a spaced Aadhaar: 1234 5678 9012 → ****-****-9012', () => {
        expect(maskSensitiveData('1234 5678 9012')).toBe('****-****-9012');
    });

    it('masks a dashed Aadhaar: 1234-5678-9012 → ****-****-9012', () => {
        expect(maskSensitiveData('1234-5678-9012')).toBe('****-****-9012');
    });

    it('masks an unspaced Aadhaar: 123456789012 → ****-****-9012', () => {
        expect(maskSensitiveData('123456789012')).toBe('****-****-9012');
    });

    it('masks an Aadhaar with mixed separators', () => {
        expect(maskSensitiveData('1234 5678-9012')).toBe('****-****-9012');
    });

    it('masks Aadhaar inside a sentence, preserving context', () => {
        expect(maskSensitiveData('My Aadhaar number is 1234 5678 9012. Please verify.')).toBe(
            'My Aadhaar number is ****-****-9012. Please verify.',
        );
    });

    it('masks multiple Aadhaar numbers in one string', () => {
        expect(maskSensitiveData('A: 1234 5678 9012, B: 9876-5432-1098')).toBe(
            'A: ****-****-9012, B: ****-****-1098',
        );
    });

    it('does NOT mask 11 digits (partial match)', () => {
        expect(maskSensitiveData('12345678901')).toBe('12345678901');
    });

    it('does NOT mask 13 digits (partial match)', () => {
        expect(maskSensitiveData('1234567890123')).toBe('1234567890123');
    });

    it('does NOT mask 12 digits embedded in a word (word boundary)', () => {
        expect(maskSensitiveData('abc123456789012def')).toBe('abc123456789012def');
    });
});

describe('maskSensitiveData — PAN (ABCDE1234F)', () => {
    it('masks a PAN: ABCDE1234F → ABCDE****F', () => {
        expect(maskSensitiveData('ABCDE1234F')).toBe('ABCDE****F');
    });

    it('masks PAN inside a sentence', () => {
        expect(maskSensitiveData('PAN card: ABCDE1234F issued.')).toBe(
            'PAN card: ABCDE****F issued.',
        );
    });

    it('does NOT mask lowercase pan numbers', () => {
        expect(maskSensitiveData('abcde1234f')).toBe('abcde1234f');
    });

    it('does NOT mask PAN with 5 digits', () => {
        expect(maskSensitiveData('ABCDE12345F')).toBe('ABCDE12345F');
    });

    it('does NOT mask PAN with 3 digits', () => {
        expect(maskSensitiveData('ABCDE123F')).toBe('ABCDE123F');
    });

    it('does NOT mask PAN with only 4 leading letters', () => {
        expect(maskSensitiveData('ABCD1234F')).toBe('ABCD1234F');
    });
});

describe('maskSensitiveData — phone numbers (10-digit Indian)', () => {
    it('masks a 10-digit mobile: 9876543210 → ******3210', () => {
        expect(maskSensitiveData('9876543210')).toBe('******3210');
    });

    it('masks a mobile starting with 6', () => {
        expect(maskSensitiveData('Call me at 6123456789')).toBe('Call me at ******6789');
    });

    it('masks multiple phone numbers in one string', () => {
        expect(maskSensitiveData('Call 9876543210 or 9123456780')).toBe(
            'Call ******3210 or ******6780',
        );
    });

    it('does NOT mask a 10-digit number starting with 5', () => {
        expect(maskSensitiveData('5123456789')).toBe('5123456789');
    });

    it('does NOT mask an 11-digit number', () => {
        expect(maskSensitiveData('98765432101')).toBe('98765432101');
    });

    it('does NOT mask a 9-digit number', () => {
        expect(maskSensitiveData('987654321')).toBe('987654321');
    });

    it('masks a phone followed by extra digits only as the phone part', () => {
        // Aadhaar regex cannot match "9876543210 99" as 12 digits, so phone wins.
        expect(maskSensitiveData('9876543210 99')).toBe('******3210 99');
    });
});

describe('maskSensitiveData — rule ordering', () => {
    it('treats a 12-digit number starting with 9 as Aadhaar, not phone', () => {
        // Aadhaar runs first; the phone rule must not double-mask the result.
        expect(maskSensitiveData('987654321098')).toBe('****-****-1098');
    });

    it('masks Aadhaar + PAN + phone together in mixed content', () => {
        const input = 'Aadhaar 1234 5678 9012, PAN ABCDE1234F, phone 9876543210.';
        expect(maskSensitiveData(input)).toBe(
            'Aadhaar ****-****-9012, PAN ABCDE****F, phone ******3210.',
        );
    });

    it('leaves no raw PII in the output for combined input', () => {
        const out = maskSensitiveData('id 123456789012 pan ABCDE1234F ph 9876543210');
        expect(out).not.toContain('123456789012');
        expect(out).not.toContain('ABCDE1234F');
        expect(out).not.toContain('9876543210');
    });
});

describe('maskSensitiveData — passthrough and false positives', () => {
    it('returns plain text unchanged', () => {
        const text = 'Hello world, this is a test with no sensitive data.';
        expect(maskSensitiveData(text)).toBe(text);
    });

    it('returns empty string unchanged', () => {
        expect(maskSensitiveData('')).toBe('');
    });

    it('does NOT mask dates like 2026-09-29', () => {
        expect(maskSensitiveData('Date: 2026-09-29')).toBe('Date: 2026-09-29');
    });

    it('does NOT mask small amounts like Rs. 5000', () => {
        expect(maskSensitiveData('Total: Rs. 5000')).toBe('Total: Rs. 5000');
    });

    it('does NOT mask 6-digit pincodes like 110001', () => {
        expect(maskSensitiveData('Pincode 110001')).toBe('Pincode 110001');
    });

    it('does NOT mask bank-account-like numbers (bank rule intentionally disabled)', () => {
        // maskBankAccount is commented out in the pipeline to avoid false positives.
        expect(maskSensitiveData('Account 12345678')).toBe('Account 12345678');
        expect(maskSensitiveData('Account 1234567890123456')).toBe(
            'Account 1234567890123456',
        );
    });
});

describe('maskSensitiveData — idempotency', () => {
    it('is stable when applied twice', () => {
        const input = 'Aadhaar 1234 5678 9012, PAN ABCDE1234F, phone 9876543210, plain text.';
        const once = maskSensitiveData(input);
        expect(maskSensitiveData(once)).toBe(once);
    });

    it('leaves already-masked Aadhaar unchanged', () => {
        expect(maskSensitiveData('****-****-9012')).toBe('****-****-9012');
    });

    it('leaves already-masked PAN unchanged', () => {
        expect(maskSensitiveData('ABCDE****F')).toBe('ABCDE****F');
    });

    it('leaves already-masked phone unchanged', () => {
        expect(maskSensitiveData('******3210')).toBe('******3210');
    });
});
