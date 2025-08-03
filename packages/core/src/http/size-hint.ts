/**
 * Represents a size range with a lower and an optional upper bound.
 *
 * This is used as hints in response bodies to determine their possible size.
 */
export class SizeHint {
    public readonly lower: number;
    public readonly upper: number | null;

    private constructor(lower: number, upper: number | null) {
        this.lower = lower;
        this.upper = upper;
    }

    /**
     * Creates a size hint with an unknown size.
     */
    public static unbounded(): SizeHint {
        return new SizeHint(0, null);
    }

    /**
     * Creates a size hint with a known range.
     */
    public static range(lower: number, upper: number): SizeHint {
        return new SizeHint(lower, upper);
    }

    /**
     * Creates a size hint with an exact size.
     */
    public static exact(value: number): SizeHint {
        return new SizeHint(value, value);
    }

    /**
     * Returns an exact size if both `lower` and `upper` are equal.
     */
    public exact(): number | null {
        return this.lower === this.upper ? this.lower : null;
    }
}
