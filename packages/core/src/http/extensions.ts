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
    public readonly id: symbol;
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: type marker
    private readonly _type: T = null as T;

    public constructor(description?: string) {
        this.id = Symbol(description);
    }

    public toString(): string {
        return `ExtensionKey(${this.id.description ?? "unknown"})`;
    }
}

/**
 * A map for setting and retrieving extensions.
 *
 * The accessors use {@link ExtensionKey}s to guarantee type-safety with the
 * associated values.
 */
export class Extensions {
    private readonly map = new Map<symbol, unknown>();

    /**
     * Inserts a value into the map associated with a specific key.
     */
    public insert<T>(key: ExtensionKey<T>, value: T): void {
        this.map.set(key.id, value);
    }

    /**
     * Retrieves the value associated with the specified key from the map.
     */
    public get<T>(key: ExtensionKey<T>): T | undefined {
        return this.map.get(key.id) as T | undefined;
    }

    /**
     * Removes a value associated with the specified key from the map.
     */
    public remove<T>(key: ExtensionKey<T>): void {
        this.map.delete(key.id);
    }

    /**
     * Determines whether the specified key exists in the map.
     */
    public has<T>(key: ExtensionKey<T>): boolean {
        return this.map.has(key.id);
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
}
