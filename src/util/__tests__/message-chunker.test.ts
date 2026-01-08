import { chunkMessage } from '../message-chunker';

describe('chunkMessage', () => {
    it('returns single chunk for short messages', () => {
        expect(chunkMessage('Hello world', 200)).toEqual(['Hello world']);
    });

    it('splits long messages at word boundaries', () => {
        const msg = 'word1 '.repeat(50); // 300 chars
        const chunks = chunkMessage(msg, 200);
        expect(chunks).toHaveLength(2);
        expect(chunks[0].length).toBeLessThanOrEqual(200);
        expect(chunks[1].length).toBeLessThanOrEqual(200);
    });

    it('enforces minimum chunk size for long words', () => {
        const msg = 'a'.repeat(300);
        const chunks = chunkMessage(msg, 200);
        expect(chunks).toHaveLength(2);
        expect(chunks[0].length).toBe(200);
        expect(chunks[1].length).toBe(100);
    });

    it('handles edge case of exactly max length', () => {
        const msg = 'a'.repeat(200);
        const chunks = chunkMessage(msg, 200);
        expect(chunks).toEqual([msg]);
    });

    it('handles edge case of max length + 1', () => {
        const msg = 'a'.repeat(201);
        const chunks = chunkMessage(msg, 200);
        expect(chunks).toHaveLength(2);
        expect(chunks[0].length).toBeGreaterThanOrEqual(100); // 50% threshold
    });

    it('trims leading whitespace from subsequent chunks', () => {
        const msg = `Hello ${'a'.repeat(300)}`;
        const chunks = chunkMessage(msg, 200);
        expect(chunks[1]).not.toMatch(/^\s/);
    });

    it('handles messages with multiple spaces', () => {
        const msg = 'word1  word2  word3  '.repeat(10); // ~210 chars with double spaces
        const chunks = chunkMessage(msg, 200);
        // After collapsing whitespace, this message fits in fewer chunks
        expect(chunks.length).toBeGreaterThanOrEqual(1);
        // Subsequent chunks should have leading whitespace trimmed
        for (let i = 1; i < chunks.length; i++) {
            expect(chunks[i]).not.toMatch(/^\s/);
        }
        // Verify whitespace was collapsed
        chunks.forEach((chunk) => {
            expect(chunk).not.toMatch(/\s{2,}/);
        });
    });

    it('splits at the last space before the limit', () => {
        // Create a message with spaces at known positions
        const msg = `${'a'.repeat(150)} ${'b'.repeat(150)}`;
        const chunks = chunkMessage(msg, 200);
        expect(chunks).toHaveLength(2);
        // First chunk should end at the space (150 chars of 'a')
        expect(chunks[0]).toBe('a'.repeat(150));
        // Second chunk should be the 'b' part
        expect(chunks[1]).toBe('b'.repeat(150));
    });

    it('handles empty string', () => {
        expect(chunkMessage('', 200)).toEqual([]);
    });

    it('handles single character messages', () => {
        expect(chunkMessage('a', 200)).toEqual(['a']);
    });

    it('splits very long messages into many chunks', () => {
        const msg = 'a'.repeat(1000);
        const chunks = chunkMessage(msg, 200);
        expect(chunks).toHaveLength(5);
        chunks.forEach((chunk, index) => {
            if (index < chunks.length - 1) {
                expect(chunk.length).toBe(200);
            } else {
                expect(chunk.length).toBeLessThanOrEqual(200);
            }
        });
    });

    it('collapses multiple spaces into single spaces', () => {
        const msg = 'Hello    world  with   multiple    spaces';
        const chunks = chunkMessage(msg, 200);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe('Hello world with multiple spaces');
    });

    it('collapses newlines and tabs into single spaces', () => {
        const msg = 'Hello\n\nworld\twith\t\tmixed\nwhitespace';
        const chunks = chunkMessage(msg, 200);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe('Hello world with mixed whitespace');
    });

    it('trims leading and trailing whitespace', () => {
        const msg = '   Hello world   ';
        const chunks = chunkMessage(msg, 200);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe('Hello world');
    });

    it('collapses whitespace before chunking to potentially avoid chunking', () => {
        // This message is 210 characters with double spaces, but only 190 with single spaces
        const msg = 'word  '.repeat(35); // 210 chars with double spaces
        const chunks = chunkMessage(msg, 200);
        // After collapsing to single spaces, it should fit in one chunk
        expect(chunks).toHaveLength(1);
    });
});
