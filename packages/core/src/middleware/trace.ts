import type { HttpRequest, HttpResponse } from "../http/index.js";
import type { HttpLayer } from "../layer/index.js";
import { getLoggerProxy, type LogLevel } from "../logging/index.js";
import type { HttpService } from "../service/index.js";

const DEFAULT_MESSAGE_LEVEL: LogLevel = "debug";
const DEFAULT_ERROR_LEVEL: LogLevel = "error";

/**
 * Interface used to classify a response.
 */
export type Classifier = {
    /**
     * Classify the response.
     *
     * If the response is successful, return null. Otherwise, return a
     * classification string for the response.
     */
    classifyResponse: (res: HttpResponse) => string | null;
};

/**
 * Interface used to tell {@link Trace} what to do when a request is received.
 */
export type OnRequest = {
    /**
     * Do the thing.
     */
    onRequest: (req: HttpRequest) => void;
};

/**
 * Interface used to tell {@link Trace} what to do when a response has been
 * produced.
 */
export type OnResponse = {
    /**
     * Do the thing.
     *
     * `latency` is the duration in milliseconds since the request was
     * received.
     */
    onResponse: (res: HttpResponse, latency: number) => void;
};

/**
 * Interface used to tell {@link Trace} what to do when a requests fails.
 */
export type OnFailure = {
    /**
     * Do the thing.
     *
     * `latency` is the duration in milliseconds since the request was
     * received.
     */
    onFailure: (classification: string, latency: number) => void;
};

export class ServerErrorAsFailureClassifier implements Classifier {
    public classifyResponse(res: HttpResponse): string | null {
        if (res.status.isServerError()) {
            return res.status.phrase;
        }

        return null;
    }
}

export class DefaultOnRequest implements OnRequest {
    private readonly level: LogLevel;

    public constructor(level: LogLevel = DEFAULT_MESSAGE_LEVEL) {
        this.level = level;
    }

    public onRequest(_req: HttpRequest): void {
        getLoggerProxy()[this.level]("started processing request");
    }
}

export class DefaultOnResponse implements OnResponse {
    private readonly level: LogLevel;
    private readonly includeHeaders: boolean;

    public constructor(level: LogLevel = DEFAULT_MESSAGE_LEVEL, includeHeaders = false) {
        this.level = level;
        this.includeHeaders = includeHeaders;
    }

    public onResponse(res: HttpResponse, latency: number): void {
        getLoggerProxy()[this.level]("finished processing request", {
            status: res.status,
            latency,
            headers: this.includeHeaders ? [...res.headers.entries()] : undefined,
        });
    }
}

export class DefaultOnFailure implements OnFailure {
    private readonly level: LogLevel;

    public constructor(level: LogLevel = DEFAULT_ERROR_LEVEL) {
        this.level = level;
    }

    public onFailure(classification: string, latency: number): void {
        getLoggerProxy()[this.level]("response failed", {
            classification,
            latency,
        });
    }
}

/**
 * A layer that traces requests and responses.
 *
 * @example
 * ```ts
 * import { TraceLayer } from "@taxum/core/middleware/trace";
 * import { m, Router } from "@taxum/core/routing";
 *
 * const router = new Router()
 *     .route("/", m.get(() => "Hello World))
 *     .layer(new TraceLayer());
 * ```
 */
export class TraceLayer implements HttpLayer {
    private classifier_: Classifier = new ServerErrorAsFailureClassifier();
    private onRequest_: OnRequest = new DefaultOnRequest();
    private onResponse_: OnResponse = new DefaultOnResponse();
    private onFailure_: OnFailure = new DefaultOnFailure();

    public classifier(classifier: Classifier): this {
        this.classifier_ = classifier;
        return this;
    }

    public onRequest(onRequest: OnRequest): this {
        this.onRequest_ = onRequest;
        return this;
    }

    public onResponse(onResponse: OnResponse): this {
        this.onResponse_ = onResponse;
        return this;
    }

    public onFailure(onFailure: OnFailure): this {
        this.onFailure_ = onFailure;
        return this;
    }

    public layer(inner: HttpService): HttpService {
        return new Trace(
            inner,
            this.classifier_,
            this.onRequest_,
            this.onResponse_,
            this.onFailure_,
        );
    }
}

export class Trace implements HttpService {
    private readonly inner: HttpService;
    private readonly classifier: Classifier;
    private readonly onRequest: OnRequest;
    private readonly onResponse: OnResponse;
    private readonly onFailure: OnFailure;

    public constructor(
        inner: HttpService,
        classifier: Classifier,
        onRequest: OnRequest,
        onResponse: OnResponse,
        onFailure: OnFailure,
    ) {
        this.inner = inner;
        this.classifier = classifier;
        this.onRequest = onRequest;
        this.onResponse = onResponse;
        this.onFailure = onFailure;
    }

    public async invoke(req: HttpRequest): Promise<HttpResponse> {
        const start = performance.now();

        this.onRequest.onRequest(req);
        const res = await this.inner.invoke(req);

        const latency = performance.now() - start;
        this.onResponse.onResponse(res, latency);

        const classification = this.classifier.classifyResponse(res);

        if (classification !== null) {
            this.onFailure.onFailure(classification, latency);
        }

        return res;
    }
}
