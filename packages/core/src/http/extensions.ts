import type util from "node:util";
import {
    type HttpResponseParts,
    TO_HTTP_RESPONSE_PARTS,
    type ToHttpResponseParts,
} from "./to-response-parts.js";

/**
 * Represents a unique identifier for an extension, defined by a symbol.
 *
 * The `ExtensionKey` class provides a way to create and manage keys for
 * extensions that are associated with a specific type, ensuring type safety and
 * uniqueness.
 *
 * @example
 * ```ts
 * import { ExtensionKey } from "taxum/core/http";
 *
 * type MyExtensionValue = { foo: string };
 * const MY_EXTENSION = new ExtensionKey<MyExtensionValue>("My extension");
 * ```
 */
export class ExtensionKey<T> {
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: type marker
    private readonly _type: T = null as T;
    private readonly description: string;

    public constructor(description: string) {
        this.description = description;
    }

    public toJSON(): string {
        return this.description;
    }

    [Symbol.for("nodejs.util.inspect.custom")](
        _depth: number,
        options: util.InspectOptionsStylized,
    ): string {
        return options.stylize(this.description, "special");
    }
}

/**
 * A map for setting and retrieving extensions.
 *
 * The accessors use {@link ExtensionKey}s to guarantee type-safety with the
 * associated values.
 */
export class Extensions implements ToHttpResponseParts {
    private readonly map = new Map<ExtensionKey<unknown>, unknown>();

    /**
     * Inserts a value into the map associated with a specific key.
     */
    public insert<T>(key: ExtensionKey<T>, value: T): void {
        this.map.set(key, value);
    }

    /**
     * Retrieves the value associated with the specified key from the map.
     */
    public get<T>(key: ExtensionKey<T>): T | undefined {
        return this.map.get(key) as T | undefined;
    }

    /**
     * Removes a value associated with the specified key from the map.
     */
    public remove<T>(key: ExtensionKey<T>): void {
        this.map.delete(key);
    }

    /**
     * Determines whether the specified key exists in the map.
     */
    public has<T>(key: ExtensionKey<T>): boolean {
        return this.map.has(key);
    }

    /**
     * Clears all key-value pairs from the map.
     */
    public clear(): void {
        this.map.clear();
    }

    /**
     * Checks whether the map is empty.
     */
    public isEmpty(): boolean {
        return this.map.size === 0;
    }

    /**
     * Retrieves the size of the map.
     */
    public len(): number {
        return this.map.size;
    }

    /**
     * Extends the current instance with entries from another instance.
     */
    public extend(other: Extensions): this {
        for (const [id, value] of other.map.entries()) {
            this.map.set(id, value);
        }

        return this;
    }

    public [TO_HTTP_RESPONSE_PARTS](res: HttpResponseParts): void {
        res.extensions.extend(this);
    }

    public toJSON(): Record<string, unknown> {
        return Object.fromEntries(this.map.entries().map(([id, value]) => [id.toJSON(), value]));
    }

    [Symbol.for("nodejs.util.inspect.custom")](
        _depth: number,
        options: util.InspectOptionsStylized,
        inspect: typeof util.inspect,
    ): string {
        return inspect(this.map, options).replace(/^Map\(\d+\)\s+\{/, "{");
    }
}
