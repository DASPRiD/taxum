/**
 * A filter that matches one or more HTTP methods.
 */
export class MethodFilter {
    /**
     *  Match `CONNECT` requests.
     */
    public static CONNECT = MethodFilter.fromBits(0b0_0000_0001);

    /**
     * Match `DELETE` requests.
     */
    public static DELETE = MethodFilter.fromBits(0b0_0000_0010);

    /**
     * Match `GET` requests.
     */
    public static GET = MethodFilter.fromBits(0b0_0000_0100);

    /**
     * Match `HEAD` requests.
     */
    public static HEAD = MethodFilter.fromBits(0b0_0000_1000);

    /**
     * Match `OPTIONS` requests.
     */
    public static OPTIONS = MethodFilter.fromBits(0b0_0001_0000);

    /**
     * Match `PATCH` requests.
     */
    public static PATCH = MethodFilter.fromBits(0b0_0010_0000);

    /**
     * Match `POST` requests.
     */
    public static POST = MethodFilter.fromBits(0b0_0100_0000);

    /**
     * Match `PUT` requests.
     */
    public static PUT = MethodFilter.fromBits(0b0_1000_0000);

    /**
     * Match `TRACE` requests.
     */
    public static TRACE = MethodFilter.fromBits(0b1_0000_0000);

    private readonly bits: number;

    private constructor(bits: number) {
        this.bits = bits;
    }

    private static fromBits(bits: number): MethodFilter {
        return new MethodFilter(bits);
    }

    /**
     * Determines if the current `MethodFilter` contains all the bits of another
     * `MethodFilter`.
     */
    public contains(other: MethodFilter): boolean {
        return (this.bits & other.bits) === other.bits;
    }

    /**
     * Combines this `MethodFilter` instance with another `MethodFilter` using a
     * logical OR operation.
     */
    public or(other: MethodFilter): MethodFilter {
        return new MethodFilter(this.bits | other.bits);
    }
}
