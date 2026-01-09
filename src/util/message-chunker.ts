/**
 * Split a message into chunks that fit within a character limit.
 * Attempts to split at word boundaries while enforcing minimum chunk size.
 *
 * @param message - The message to chunk
 * @param maxLen - Maximum characters per chunk
 * @returns Array of message chunks
 */
export function chunkMessage(message: string, maxLen: number): string[] {
    // Collapse multiple whitespaces into single spaces
    const normalized = message.replace(/\s+/g, ' ').trim();

    const segments: string[] = [];
    let remaining = normalized;

    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            segments.push(remaining);
            break;
        }

        let splitIdx = remaining.lastIndexOf(' ', maxLen);

        if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
            splitIdx = maxLen;
        }

        segments.push(remaining.slice(0, splitIdx));
        remaining = remaining.slice(splitIdx).trimStart();
    }

    return segments;
}
