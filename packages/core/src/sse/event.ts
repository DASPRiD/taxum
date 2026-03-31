/**
 * Represents a single Server-Sent Event.
 *
 * All fields are optional. At minimum, most events should include {@link SseEvent.data}.
 *
 * @example
 * ```ts
 * import type { SseEvent } from "@taxum/core/sse";
 *
 * const event: SseEvent = {
 *     event: "message",
 *     id: "1",
 *     data: "Hello, world!",
 * };
 * ```
 */
export type SseEvent = {
    /**
     * Comment lines for the event.
     *
     * Comments are lines starting with `:` and are ignored by the client. They are useful for
     * keep-alive messages.
     *
     * Must not contain carriage returns (`\r`) or newlines (`\n`).
     */
    comment?: string;

    /**
     * The event type.
     *
     * This maps to `addEventListener` on the client-side `EventSource`. If not set, the client
     * receives the event via the `message` event.
     *
     * Must not contain carriage returns (`\r`) or newlines (`\n`).
     */
    event?: string;

    /**
     * The event data.
     *
     * Newlines (`\n`), carriage returns (`\r`), and CRLF sequences (`\r\n`) in the data are
     * automatically split across multiple `data:` lines per the SSE specification.
     */
    data?: string;

    /**
     * The event ID.
     *
     * The client sends this as the `Last-Event-ID` header when reconnecting, allowing the server
     * to resume from the correct position.
     *
     * Must not contain carriage returns (`\r`), newlines (`\n`), or null characters (`\0`).
     */
    id?: string;

    /**
     * The reconnection time hint in milliseconds.
     *
     * This tells the client how long to wait before attempting to reconnect after the connection
     * is lost. Must be a non-negative integer.
     */
    retry?: number;
};

const encoder = new TextEncoder();

const serializeComment = (comment: string): string => {
    if (/[\r\n]/.test(comment)) {
        throw new Error("Comment must not contain newlines or carriage returns");
    }

    return `: ${comment}\n`;
};

const serializeEventType = (event: string): string => {
    if (/[\r\n]/.test(event)) {
        throw new Error("Event type must not contain newlines or carriage returns");
    }

    return `event: ${event}\n`;
};

const serializeData = (data: string): string => {
    let output = "";

    for (const line of data.split(/\r\n|\r|\n/)) {
        output += `data: ${line}\n`;
    }

    return output;
};

const serializeId = (id: string): string => {
    if (/[\r\n\0]/.test(id)) {
        throw new Error("Event ID must not contain newlines, carriage returns, or null characters");
    }

    return `id: ${id}\n`;
};

const serializeRetry = (retry: number): string => {
    if (!Number.isInteger(retry) || retry < 0) {
        throw new Error("Retry must be a non-negative integer");
    }

    return `retry: ${retry}\n`;
};

/**
 * Serializes an {@link SseEvent} to the SSE text wire format as bytes.
 *
 * The output follows the
 * [Server-Sent Events specification](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream).
 * Each event is terminated by a blank line (`\n`).
 *
 * @throws {@link !Error} if the comment contains a carriage return or newline.
 * @throws {@link !Error} if the event type contains a carriage return or newline.
 * @throws {@link !Error} if the ID contains a carriage return, newline, or null character.
 * @throws {@link !Error} if the retry value is not a non-negative integer.
 */
export const serializeSseEvent = (event: SseEvent): Uint8Array => {
    let output = "";

    if (event.comment !== undefined) {
        output += serializeComment(event.comment);
    }

    if (event.event !== undefined) {
        output += serializeEventType(event.event);
    }

    if (event.data !== undefined) {
        output += serializeData(event.data);
    }

    if (event.id !== undefined) {
        output += serializeId(event.id);
    }

    if (event.retry !== undefined) {
        output += serializeRetry(event.retry);
    }

    output += "\n";

    return encoder.encode(output);
};
