import type { IncomingMessage } from "node:http";

/**
 * Represents a case-insensitive map for HTTP headers, allowing insertion,
 * appending, removal, clearing, and extending of key-value pairs.
 */
export class HeaderMap {
    protected readonly map: Map<string, string[]>;

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

    public static fromIncomingMessage(message: IncomingMessage): HeaderMap {
        return new HeaderMap(
            new Map(Object.entries(message.headersDistinct as { [key: string]: string[] })),
        );
    }

    public isEmpty(): boolean {
        return this.map.size === 0;
    }

    public len(): number {
        return this.map.size;
    }

    public containsKey(key: string): boolean {
        return this.map.has(key.toLowerCase());
    }

    public get(key: string): string | null {
        const headers = this.map.get(key.toLowerCase());

        if (!headers) {
            return null;
        }

        return headers[0] ?? null;
    }

    public getAll(key: string): readonly string[] {
        return this.map.get(key.toLowerCase()) ?? [];
    }

    public keys(): IterableIterator<string> {
        return this.map.keys();
    }

    public *values(): IterableIterator<string> {
        for (const values of this.map.values()) {
            for (const value of values) {
                yield value;
            }
        }
    }

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

    public insert(key: string, value: string): void {
        this.map.set(key.toLowerCase(), [value]);
    }

    public append(key: string, value: string): void {
        const lowercaseKey = key.toLowerCase();
        let values = this.map.get(lowercaseKey);

        if (!values) {
            values = [];
            this.map.set(lowercaseKey, values);
        }

        values.push(value);
    }

    public remove(key: string): string | null {
        const lowercaseKey = key.toLowerCase();
        const value = this.map.get(lowercaseKey);
        this.map.delete(lowercaseKey);
        return value?.[0] ?? null;
    }

    public clear(): void {
        this.map.clear();
    }

    public extend(items: Iterable<[string, string]>): void {
        for (const item of items) {
            this.insert(item[0], item[1]);
        }
    }
}
