import type { HeaderValue, HttpRequest, HttpResponse } from "../http/index.js";
import type { HttpLayer } from "../layer/index.js";
import type { HttpService } from "../service/index.js";

/**
 * Mark headers as sensitive on both requests and responses.
 *
 * @see {@link HeaderValue}
 */
export class SetSensitiveHeadersLayer implements HttpLayer {
    private readonly headers: string[];

    public constructor(headers: string[]) {
        this.headers = headers;
    }

    public layer(inner: HttpService): HttpService {
        return new SetSensitiveRequestHeaders(
            new SetSensitiveResponseHeaders(inner, this.headers),
            this.headers,
        );
    }
}

/**
 * Marks request headers as sensitive.
 *
 * @see {@link HeaderValue}
 */
export class SetSensitiveRequestHeadersLayer implements HttpLayer {
    private readonly headers: string[];

    public constructor(headers: string[]) {
        this.headers = headers;
    }

    public layer(inner: HttpService): HttpService {
        return new SetSensitiveRequestHeaders(inner, this.headers);
    }
}

/**
 * Marks response headers as sensitive.
 *
 * @see {@link HeaderValue}
 */
export class SetSensitiveResponseHeadersLayer implements HttpLayer {
    private readonly headers: string[];

    public constructor(headers: string[]) {
        this.headers = headers;
    }

    public layer(inner: HttpService): HttpService {
        return new SetSensitiveResponseHeaders(inner, this.headers);
    }
}

/**
 * Marks request headers as sensitive.
 *
 * @see {@link HeaderValue}
 */
export class SetSensitiveRequestHeaders implements HttpService {
    private readonly inner: HttpService;
    private readonly headers: string[];

    public constructor(inner: HttpService, headers: string[]) {
        this.inner = inner;
        this.headers = headers;
    }

    public invoke(req: HttpRequest): Promise<HttpResponse> | HttpResponse {
        for (const header of this.headers) {
            for (const value of req.headers.getAll(header)) {
                value.setSensitive(true);
            }
        }

        return this.inner.invoke(req);
    }
}

/**
 * Marks response headers as sensitive.
 *
 * @see {@link HeaderValue}
 */
export class SetSensitiveResponseHeaders implements HttpService {
    private readonly inner: HttpService;
    private readonly headers: string[];

    public constructor(inner: HttpService, headers: string[]) {
        this.inner = inner;
        this.headers = headers;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const res = await this.inner.invoke(req);

        for (const header of this.headers) {
            for (const value of res.headers.getAll(header)) {
                value.setSensitive(true);
            }
        }

        return res;
    }
}
