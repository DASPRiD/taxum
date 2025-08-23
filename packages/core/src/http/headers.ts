import type { IncomingMessage } from "node:http";
import type util from "node:util";
import {
    type HttpResponseParts,
    TO_HTTP_RESPONSE_PARTS,
    type ToHttpResponseParts,
} from "./to-response-parts.js";

/**
 * Represents a case-insensitive map for HTTP headers.
 *
 * Allows insertion, appending, removal, clearing, and extending of key-value
 * pairs.
 */
export class HeaderMap implements ToHttpResponseParts {
    protected readonly map: Map<string, HeaderValue[]>;

    /**
     * Creates a new {@link HeaderMap}.
     *
     * You can optionally provide entries to initialize the map with existing
     * key-value pairs.
     **/
    public constructor(entries?: Iterable<HeaderEntry> | HeaderMap) {
        if (!entries) {
            this.map = new Map();
            return;
        }

        if (entries instanceof HeaderMap) {
            this.map = new Map(entries.map.entries().map(([name, values]) => [name, [...values]]));
            return;
        }

        this.map = new Map();

        for (const [name, value] of entries) {
            const normalizedName = name.toLowerCase();
            let values = this.map.get(normalizedName);

            if (!values) {
                values = [];
                this.map.set(normalizedName, values);
            }

            values.push(value);
        }
    }

    /**
     * Create a new {@link HeaderMap} from an `Iterable` of key-value pairs.
     *
     * This allows you to create the map from string values instead of
     * `HeaderValue`s.
     */
    public static from(entries: Iterable<HeaderEntryLike>): HeaderMap {
        const headerEntries: Iterable<HeaderEntry> = {
            [Symbol.iterator]: function* () {
                for (const [name, value] of entries) {
                    yield [name, value instanceof HeaderValue ? value : new HeaderValue(value)];
                }
            },
        };

        return new HeaderMap(headerEntries);
    }

    /**
     * Creates a new {@link HeaderMap} from the provided {@link IncomingMessage}.
     *
     * Converts the headers of the IncomingMessage into a map structure that can
     * be used by the HeaderMap.
     */
    public static fromIncomingMessage(message: IncomingMessage): HeaderMap {
        const entries: HeaderEntry[] = [];

        for (const [name, values] of Object.entries(message.headersDistinct)) {
            /* node:coverage ignore next 3 */
            if (!values) {
                continue;
            }

            for (const value of values) {
                entries.push([name, new HeaderValue(value)]);
            }
        }

        return new HeaderMap(entries);
    }

    /**
     * Determines whether the map contains no elements.
     */
    public isEmpty(): boolean {
        return this.map.size === 0;
    }

    /**
     * Returns the number of elements in the map.
     */
    public len(): number {
        return this.map.size;
    }

    /**
     * Checks if the given key exists in the map.
     */
    public containsKey(key: string): boolean {
        return this.map.has(key.toLowerCase());
    }

    /**
     * Retrieves the first value associated with the specified key.
     */
    public get(key: string): HeaderValue | null {
        const headers = this.map.get(key.toLowerCase());

        if (!headers) {
            return null;
        }

        return headers[0];
    }

    /**
     * Retrieves all values associated with the provided key.
     */
    public getAll(key: string): readonly HeaderValue[] {
        return this.map.get(key.toLowerCase()) ?? [];
    }

    /**
     * Retrieves an iterator that allows iteration over all the keys in the map.
     */
    public keys(): IterableIterator<string> {
        return this.map.keys();
    }

    /**
     * Returns an iterator that yields all values stored in the internal map.
     *
     * The values are yielded sequentially from the inner collections.
     */
    public *values(): IterableIterator<HeaderValue> {
        for (const values of this.map.values()) {
            for (const value of values) {
                yield value;
            }
        }
    }

    /**
     * Returns an iterator of key-value pairs where keys and values are strings.
     *
     * Each key may correspond to multiple values, and the iterator yields each
     * key-value pair individually.
     */
    public *entries(): IterableIterator<HeaderEntry> {
        for (const [key, values] of this.map.entries()) {
            for (const value of values) {
                yield [key, value];
            }
        }
    }

    public [Symbol.iterator](): IterableIterator<HeaderEntry> {
        return this.entries();
    }

    /**
     * Inserts a key-value pair into the map.
     *
     * If one or more values already exist for the key, they are replaced with
     * the new value.
     */
    public insert(key: string, value: HeaderValueLike): void {
        this.map.set(key.toLowerCase(), [
            value instanceof HeaderValue ? value : new HeaderValue(value),
        ]);
    }

    /**
     * Appends a value to the list of values associated with the specified key.
     *
     * If the key does not exist, it initializes a new list and adds the value
     * to it.
     */
    public append(key: string, value: HeaderValueLike): void {
        const lowercaseKey = key.toLowerCase();
        let values = this.map.get(lowercaseKey);

        if (!values) {
            values = [];
            this.map.set(lowercaseKey, values);
        }

        values.push(value instanceof HeaderValue ? value : new HeaderValue(value));
    }

    /**
     * Removes the entry associated with the specified key from the map.
     */
    public remove(key: string): HeaderValue | null {
        const lowercaseKey = key.toLowerCase();
        const value = this.map.get(lowercaseKey);
        this.map.delete(lowercaseKey);
        return value?.[0] ?? null;
    }

    /**
     * Clears the entire map.
     */
    public clear(): void {
        this.map.clear();
    }

    /**
     * Extends the map by inserting key-value pairs from the given iterable.
     *
     * Values in the iterable will overwrite existing values for the same key.
     */
    public extend(items: Iterable<HeaderEntry>): void {
        for (const item of items) {
            this.insert(item[0], item[1]);
        }
    }

    public toJSON(): [string, string][] {
        const result: [string, string][] = [];

        for (const [name, values] of this.map) {
            for (const value of values) {
                if (!value.isSensitive()) {
                    result.push([name, value.toJSON()]);
                }
            }
        }

        return result;
    }

    [Symbol.for("nodejs.util.inspect.custom")](
        _depth: number,
        options: util.InspectOptionsStylized,
        inspect: typeof util.inspect,
    ): string {
        const result: Record<string, HeaderValue | HeaderValue[]> = {};

        for (const [key, values] of this.map) {
            result[key] = values.length === 1 ? values[0] : values;
        }

        return inspect(result, options);
    }

    public [TO_HTTP_RESPONSE_PARTS](res: HttpResponseParts): void {
        res.headers.extend(this);
    }
}

/**
 * Represents a single value in an HTTP header.
 *
 * Some header values may be sensitive and should not be logged or displayed.
 * You can mark headers as sensitive by calling `setSensitive(true)`. This will
 * prevent the value from being exposed to loggers.
 */
export class HeaderValue {
    public readonly value: string;
    private sensitive: boolean;

    /**
     * Creates a new {@link HeaderValue}.
     */
    public constructor(value: string, sensitive = false) {
        this.value = value;
        this.sensitive = sensitive;
    }

    /**
     * Marks the header value as sensitive.
     */
    public setSensitive(sensitive: boolean): this {
        this.sensitive = sensitive;
        return this;
    }

    /**
     * Checks if the header value is sensitive.
     */
    public isSensitive(): boolean {
        return this.sensitive;
    }

    public toJSON(): string {
        return this.sensitive ? "Sensitive" : this.value;
    }

    [Symbol.for("nodejs.util.inspect.custom")](
        _depth: number,
        options: util.InspectOptionsStylized,
        inspect: typeof util.inspect,
    ): string {
        if (this.sensitive) {
            return options.stylize("Sensitive", "special");
        }

        return inspect(this.value, options);
    }
}

export type HeaderValueLike = HeaderValue | string;
export type HeaderEntryLike = [name: string, value: HeaderValueLike];
export type HeaderEntry = [name: string, value: HeaderValue];
