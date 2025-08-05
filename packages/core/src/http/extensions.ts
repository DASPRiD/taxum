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
        return `ExtensionKey(${this.id.toString()})`;
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

    public insert<T>(key: ExtensionKey<T>, value: T): void {
        this.map.set(key.id, value);
    }

    public get<T>(key: ExtensionKey<T>): T | undefined {
        return this.map.get(key.id) as T | undefined;
    }

    public remove<T>(key: ExtensionKey<T>): void {
        this.map.delete(key.id);
    }

    public has<T>(key: ExtensionKey<T>): boolean {
        return this.map.has(key.id);
    }

    public clear(): void {
        this.map.clear();
    }

    public isEmpty(): boolean {
        return this.map.size === 0;
    }

    public len(): number {
        return this.map.size;
    }

    public extend(other: Extensions): this {
        for (const [id, value] of other.map.entries()) {
            this.map.set(id, value);
        }

        return this;
    }
}
