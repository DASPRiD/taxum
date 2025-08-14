import { HttpResponse } from "./response.js";
import { TO_HTTP_RESPONSE, type ToHttpResponse } from "./to-response.js";

const codeMap = new Map<number, StatusCode>();

/**
 * Represents HTTP status codes along with their standard reason phrases.
 *
 * This class provides a set of constants corresponding to standard HTTP status
 * codes, which are compliant with various RFC documents. It enables developers
 * to use predefined instances for status codes and reason phrases, thus
 * improving readability and reducing potential errors.
 *
 * The `StatusCode` class implements the `ToHttpResponse` interface, which may
 * provide additional functionality when interacting with HTTP responses.
 */
export class StatusCode implements ToHttpResponse {
    /**
     * 100 Continue
     * [[RFC9110, Section 15.2.1]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.2.1)
     */
    public static readonly CONTINUE = StatusCode.create(100, "Continue");

    /**
     * 101 Switching Protocols
     * [[RFC9110, Section 15.2.2]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.2.2)
     */
    public static readonly SWITCHING_PROTOCOLS = StatusCode.create(101, "Switching Protocols");

    /**
     * 102 Processing
     * [[RFC2518, Section 10.1]](https://datatracker.ietf.org/doc/html/rfc2518#section-10.1)
     */
    public static readonly PROCESSING = StatusCode.create(102, "Processing");

    /**
     * 200 OK
     * [[RFC9110, Section 15.3.1]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.3.1)
     */
    public static readonly OK = StatusCode.create(200, "OK");

    /**
     * 201 Created
     * [[RFC9110, Section 15.3.2]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.3.2)
     */
    public static readonly CREATED = StatusCode.create(201, "Created");

    /**
     * 202 Accepted
     * [[RFC9110, Section 15.3.3]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.3.3)
     */
    public static readonly ACCEPTED = StatusCode.create(202, "Accepted");

    /**
     * 203 Non-Authoritative Information
     * [[RFC9110, Section 15.3.4]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.3.4)
     */
    public static readonly NON_AUTHORITATIVE_INFORMATION = StatusCode.create(
        203,
        "Non Authoritative Information",
    );

    /**
     * 204 No Content
     * [[RFC9110, Section 15.3.5]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.3.5)
     */
    public static readonly NO_CONTENT = StatusCode.create(204, "No Content");

    /**
     * 205 Reset Content
     * [[RFC9110, Section 15.3.6]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.3.6)
     */
    public static readonly RESET_CONTENT = StatusCode.create(205, "Reset Content");

    /**
     * 206 Partial Content
     * [[RFC9110, Section 15.3.7]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.3.7)
     */
    public static readonly PARTIAL_CONTENT = StatusCode.create(206, "Partial Content");

    /**
     * 207 Multi-Status
     * [[RFC4918, Section 11.1]](https://datatracker.ietf.org/doc/html/rfc4918#section-11.1)
     */
    public static readonly MULTI_STATUS = StatusCode.create(207, "Multi-Status");

    /**
     * 208 Already Reported
     * [[RFC5842, Section 7.1]](https://datatracker.ietf.org/doc/html/rfc5842#section-7.1)
     */
    public static readonly ALREADY_REPORTED = StatusCode.create(208, "Already Reported");

    /**
     * 226 IM Used
     * [[RFC3229, Section 10.4.1]](https://datatracker.ietf.org/doc/html/rfc3229#section-10.4.1)
     */
    public static readonly IM_USED = StatusCode.create(226, "IM Used");

    /**
     * 300 Multiple Choices
     * [[RFC9110, Section 15.4.1]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.1)
     */
    public static readonly MULTIPLE_CHOICES = StatusCode.create(300, "Multiple Choices");

    /**
     * 301 Moved Permanently
     * [[RFC9110, Section 15.4.2]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.2)
     */
    public static readonly MOVED_PERMANENTLY = StatusCode.create(301, "Moved Permanently");

    /**
     * 302 Found
     * [[RFC9110, Section 15.4.3]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.3)
     */
    public static readonly FOUND = StatusCode.create(302, "Found");

    /**
     * 303 See Other
     * [[RFC9110, Section 15.4.4]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.4)
     */
    public static readonly SEE_OTHER = StatusCode.create(303, "See Other");

    /**
     * 304 Not Modified
     * [[RFC9110, Section 15.4.5]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.5)
     */
    public static readonly NOT_MODIFIED = StatusCode.create(304, "Not Modified");

    /**
     * 305 Use Proxy
     * [[RFC9110, Section 15.4.6]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.6)
     */
    public static readonly USE_PROXY = StatusCode.create(305, "Use Proxy");

    /**
     * 307 Temporary Redirect
     * [[RFC9110, Section 15.4.7]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.7)
     */
    public static readonly TEMPORARY_REDIRECT = StatusCode.create(307, "Temporary Redirect");

    /**
     * 308 Permanent Redirect
     * [[RFC9110, Section 15.4.8]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.8)
     */
    public static readonly PERMANENT_REDIRECT = StatusCode.create(308, "Permanent Redirect");

    /**
     * 400 Bad Request
     * [[RFC9110, Section 15.5.1]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.1)
     */
    public static readonly BAD_REQUEST = StatusCode.create(400, "Bad Request");

    /**
     * 401 Unauthorized
     * [[RFC9110, Section 15.5.2]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.2)
     */
    public static readonly UNAUTHORIZED = StatusCode.create(401, "Unauthorized");

    /**
     * 402 Payment Required
     * [[RFC9110, Section 15.5.3]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.3)
     */
    public static readonly PAYMENT_REQUIRED = StatusCode.create(402, "Payment Required");

    /**
     * 403 Forbidden
     * [[RFC9110, Section 15.5.4]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.4)
     */
    public static readonly FORBIDDEN = StatusCode.create(403, "Forbidden");

    /**
     * 404 Not Found
     * [[RFC9110, Section 15.5.5]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.5)
     */
    public static readonly NOT_FOUND = StatusCode.create(404, "Not Found");

    /**
     * 405 Method Not Allowed
     * [[RFC9110, Section 15.5.6]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.6)
     */
    public static readonly METHOD_NOT_ALLOWED = StatusCode.create(405, "Method Not Allowed");

    /**
     * 406 Not Acceptable
     * [[RFC9110, Section 15.5.7]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.7)
     */
    public static readonly NOT_ACCEPTABLE = StatusCode.create(406, "Not Acceptable");

    /**
     * 407 Proxy Authentication Required
     * [[RFC9110, Section 15.5.8]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.8)
     */
    public static readonly PROXY_AUTHENTICATION_REQUIRED = StatusCode.create(
        407,
        "Proxy Authentication Required",
    );

    /**
     * 408 Request Timeout
     * [[RFC9110, Section 15.5.9]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.9)
     */
    public static readonly REQUEST_TIMEOUT = StatusCode.create(408, "Request Timeout");

    /**
     * 409 Conflict
     * [[RFC9110, Section 15.5.10]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.10)
     */
    public static readonly CONFLICT = StatusCode.create(409, "Conflict");

    /**
     * 410 Gone
     * [[RFC9110, Section 15.5.11]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.11)
     */
    public static readonly GONE = StatusCode.create(410, "Gone");

    /**
     * 411 Length Required
     * [[RFC9110, Section 15.5.12]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.12)
     */
    public static readonly LENGTH_REQUIRED = StatusCode.create(411, "Length Required");

    /**
     * 412 Precondition Failed
     * [[RFC9110, Section 15.5.13]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.13)
     */
    public static readonly PRECONDITION_FAILED = StatusCode.create(412, "Precondition Failed");

    /**
     * 413 Content Too Large
     * [[RFC9110, Section 15.5.14]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.14)
     */
    public static readonly CONTENT_TOO_LARGE = StatusCode.create(413, "Content Too Large");

    /**
     * 414 URI Too Long
     * [[RFC9110, Section 15.5.15]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.15)
     */
    public static readonly URI_TOO_LONG = StatusCode.create(414, "URI Too Long");

    /**
     * 415 Unsupported Media Type
     * [[RFC9110, Section 15.5.16]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.16)
     */
    public static readonly UNSUPPORTED_MEDIA_TYPE = StatusCode.create(
        415,
        "Unsupported Media Type",
    );

    /**
     * 416 Range Not Satisfiable
     * [[RFC9110, Section 15.5.17]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.17)
     */
    public static readonly RANGE_NOT_SATISFIABLE = StatusCode.create(416, "Range Not Satisfiable");

    /**
     * 417 Expectation Failed
     * [[RFC9110, Section 15.5.18]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.18)
     */
    public static readonly EXPECTATION_FAILED = StatusCode.create(417, "Expectation Failed");

    /**
     * 418 I'm a teapot
     * [[RFC7168]](https://datatracker.ietf.org/doc/html/rfc7168)
     */
    public static readonly IM_A_TEAPOT = StatusCode.create(418, "I'm a teapot");

    /**
     * 421 Misdirected Request
     * [[RFC9110, Section 15.5.20]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.20)
     */
    public static readonly MISDIRECTED_REQUEST = StatusCode.create(421, "Misdirected Request");

    /**
     * 422 Unprocessable Content
     * [[RFC9110, Section 15.5.21]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.21)
     */
    public static readonly UNPROCESSABLE_CONTENT = StatusCode.create(422, "Unprocessable Content");

    /**
     * 423 Locked
     * [[RFC4918, Section 11.3]](https://datatracker.ietf.org/doc/html/rfc4918#section-11.3)
     */
    public static readonly LOCKED = StatusCode.create(423, "Locked");

    /**
     * 424 Failed Dependency
     * [[RFC4918, Section 11.4]](https://datatracker.ietf.org/doc/html/rfc4918#section-11.4)
     */
    public static readonly FAILED_DEPENDENCY = StatusCode.create(424, "Failed Dependency");

    /**
     * 425 Too Early
     * [[RFC8470, Section 5.2]](https://datatracker.ietf.org/doc/html/rfc8470#section-5.2)
     */
    public static readonly TOO_EARLY = StatusCode.create(425, "Too Early");

    /**
     * 426 Upgrade Required
     * [[RFC9110, Section 15.5.22]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.22)
     */
    public static readonly UPGRADE_REQUIRED = StatusCode.create(426, "Upgrade Required");

    /**
     * 428 Precondition Required
     * [[RFC6585, Section 3]](https://datatracker.ietf.org/doc/html/rfc6585#section-3)
     */
    public static readonly PRECONDITION_REQUIRED = StatusCode.create(428, "Precondition Required");

    /**
     * 429 Too Many Requests
     * [[RFC6585, Section 4]](https://datatracker.ietf.org/doc/html/rfc6585#section-4)
     */
    public static readonly TOO_MANY_REQUESTS = StatusCode.create(429, "Too Many Requests");

    /**
     * 431 Request Header Fields Too Large
     * [[RFC6585, Section 5]](https://datatracker.ietf.org/doc/html/rfc6585#section-5)
     */
    public static readonly REQUEST_HEADER_FIELDS_TOO_LARGE = StatusCode.create(
        431,
        "Request Header Fields Too Large",
    );

    /**
     * 451 Unavailable For Legal Reasons
     * [[RFC7725]](https://datatracker.ietf.org/doc/html/rfc7725)
     */
    public static readonly UNAVAILABLE_FOR_LEGAL_REASONS = StatusCode.create(
        451,
        "Unavailable For Legal Reasons",
    );

    /**
     * 500 Internal Server Error
     * [[RFC9110, Section 15.6.1]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.1)
     */
    public static readonly INTERNAL_SERVER_ERROR = StatusCode.create(500, "Internal Server Error");

    /**
     * 501 Not Implemented
     * [[RFC9110, Section 15.6.2]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.2)
     */
    public static readonly NOT_IMPLEMENTED = StatusCode.create(501, "Not Implemented");

    /**
     * 502 Bad Gateway
     * [[RFC9110, Section 15.6.3]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.3)
     */
    public static readonly BAD_GATEWAY = StatusCode.create(502, "Bad Gateway");

    /**
     * 503 Service Unavailable
     * [[RFC9110, Section 15.6.4]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.4)
     */
    public static readonly SERVICE_UNAVAILABLE = StatusCode.create(503, "Service Unavailable");

    /**
     * 504 Gateway Timeout
     * [[RFC9110, Section 15.6.5]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.5)
     */
    public static readonly GATEWAY_TIMEOUT = StatusCode.create(504, "Gateway Timeout");

    /**
     * 505 HTTP Version Not Supported
     * [[RFC9110, Section 15.6.6]](https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.6)
     */
    public static readonly HTTP_VERSION_NOT_SUPPORTED = StatusCode.create(
        505,
        "HTTP Version Not Supported",
    );

    /**
     * 506 Variant Also Negotiates
     * [[RFC2295, Section 8.1]](https://datatracker.ietf.org/doc/html/rfc2295#section-8.1)
     */
    public static readonly VARIANT_ALSO_NEGOTIATES = StatusCode.create(
        506,
        "Variant Also Negotiates",
    );

    /**
     * 507 Insufficient Storage
     * [[RFC4918, Section 11.5]](https://datatracker.ietf.org/doc/html/rfc4918#section-11.5)
     */
    public static readonly INSUFFICIENT_STORAGE = StatusCode.create(507, "Insufficient Storage");

    /**
     * 508 Loop Detected
     * [[RFC5842, Section 7.2]](https://datatracker.ietf.org/doc/html/rfc5842#section-7.2)
     */
    public static readonly LOOP_DETECTED = StatusCode.create(508, "Loop Detected");

    /**
     * 510 Not Extended
     * [[RFC2774, Section 7]](https://datatracker.ietf.org/doc/html/rfc2774#section-7)
     */
    public static readonly NOT_EXTENDED = StatusCode.create(510, "Not Extended");

    /**
     * 511 Network Authentication Required
     * [[RFC6585, Section 6]](https://datatracker.ietf.org/doc/html/rfc6585#section-6)
     */
    public static readonly NETWORK_AUTHENTICATION_REQUIRED = StatusCode.create(
        511,
        "Network Authentication Required",
    );

    public readonly code: number;
    public readonly phrase: string;

    private constructor(code: number, phrase: string) {
        this.code = code;
        this.phrase = phrase;
    }

    private static create(code: number, phrase: string): StatusCode {
        const statusCode = new StatusCode(code, phrase);
        codeMap.set(code, statusCode);
        return statusCode;
    }

    /**
     * Converts a numeric code to its corresponding StatusCode.
     *
     * @throws {Error} if the provided code is not defined in the code map.
     */
    public static fromCode(code: number): StatusCode {
        const statusCode = codeMap.get(code);

        if (!statusCode) {
            throw new Error(`Status code ${code} is not defined`);
        }

        return statusCode;
    }

    /**
     * Determines if the current HTTP status code falls within the informational
     * response range (100-199).
     */
    public isInformational() {
        return this.code >= 100 && this.code < 200;
    }

    /**
     * Determines if the current HTTP status code falls within the success
     * response range (200-299).
     */
    public isSuccess() {
        return this.code >= 200 && this.code < 300;
    }

    /**
     * Determines if the current HTTP status code falls within the redirection
     * response range (300-399).
     */
    public isRedirection() {
        return this.code >= 300 && this.code < 400;
    }

    /**
     * Determines if the current HTTP status code falls within the client error
     * response range (400-499).
     */
    public isClientError() {
        return this.code >= 400 && this.code < 500;
    }

    /**
     * Determines if the current HTTP status code falls within the server error
     * response range (500-599).
     */
    public isServerError() {
        return this.code >= 500 && this.code < 600;
    }

    public toString(): string {
        return `StatusCode(${this.code} ${this.phrase})`;
    }

    public [TO_HTTP_RESPONSE](): HttpResponse {
        return HttpResponse.builder().status(this).body(null);
    }
}
