import type { IncomingMessage } from "node:http";

/**
 * Represents a case-insensitive map for HTTP headers.
 *
 * Allows insertion, appending, removal, clearing, and extending of key-value
 * pairs.
 */
export class HeaderMap {
    protected readonly map: Map<string, string[]>;

    /**
     * Creates a new {@link HeaderMap}.
     *
     * An optional map can be provided to initialize the map with existing
     * key-value pairs.
     **/
    public constructor(map?: Map<string, string[]> | HeaderMap) {
        if (!map) {
            this.map = new Map();
            return;
        }

        if (map instanceof HeaderMap) {
            this.map = new Map(map.map.entries());
            return;
        }

        this.map = new Map(map.entries().map(([key, values]) => [key.toLowerCase(), values]));
    }

    /**
     * Creates a new {@link HeaderMap} from the provided {@link IncomingMessage}.
     *
     * Converts the headers of the IncomingMessage into a map structure that can
     * be used by the HeaderMap.
     */
    public static fromIncomingMessage(message: IncomingMessage): HeaderMap {
        return new HeaderMap(
            new Map(Object.entries(message.headersDistinct as { [key: string]: string[] })),
        );
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
    public get(key: string): string | null {
        const headers = this.map.get(key.toLowerCase());

        if (!headers) {
            return null;
        }

        return headers[0] ?? null;
    }

    /**
     * Retrieves all values associated with the provided key.
     */
    public getAll(key: string): readonly string[] {
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
    public *values(): IterableIterator<string> {
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
    public *entries(): IterableIterator<[string, string]> {
        for (const [key, values] of this.map.entries()) {
            for (const value of values) {
                yield [key, value];
            }
        }
    }

    public [Symbol.iterator]() {
        return this.entries();
    }

    /**
     * Inserts a key-value pair into the map.
     *
     * If one or more values already exist for the key, they are replaced with
     * the new value.
     */
    public insert(key: string, value: string): void {
        this.map.set(key.toLowerCase(), [value]);
    }

    /**
     * Appends a value to the list of values associated with the specified key.
     *
     * If the key does not exist, it initializes a new list and adds the value
     * to it.
     */
    public append(key: string, value: string): void {
        const lowercaseKey = key.toLowerCase();
        let values = this.map.get(lowercaseKey);

        if (!values) {
            values = [];
            this.map.set(lowercaseKey, values);
        }

        values.push(value);
    }

    /**
     * Removes the entry associated with the specified key from the map.
     */
    public remove(key: string): string | null {
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
    public extend(items: Iterable<[string, string]>): void {
        for (const item of items) {
            this.insert(item[0], item[1]);
        }
    }
}
