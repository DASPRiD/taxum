import { PassThrough, pipeline, Readable, type Transform } from "node:stream";

/**
 * A readable stream enabling lazy reading from a source stream* while applying
 * a transformation via a Transform stream.
 *
 * The stream defers initialization of the pipeline connecting the source
 * stream, the transformation, and this readable instance until it is read the
 * first time.
 *
 * When transforming a request or response body, it should be preferred to not
 * directly pipe the source stream to the transform stream, but to use this
 * `LazyWrappedReadable` instead. This ensures that the transformation only
 * happens when actually required, as well as read errors being caught at the
 * point of use.
 *
 * @example
 * ```ts
 * import { LazyWrappedReadable } from "@taxum/core/http";
 * import { m, Router } from "@taxum/core/routing";
 * import { fromFn } from "@taxum/core/middleware";
 *
 * const transformLayer = fromFn((req, next) => {
 *     return next.invoke(req.withBody(
 *         new LazyWrappedReadable(req.body, new Transform({
 *             transform(chunk, encoding, callback) {
 *                 // do something with `chunk`
 *                 callback(null, chunk);
 *             },
 *         }))
 *     ));
 * });
 *
 * const router = new Router()
 *     .route("/users", m.get(() => "Hello World!"))
 *     .layer(transformLayer);
 * ```
 */
export class LazyWrappedReadable extends Readable {
    private readonly passthrough: PassThrough;
    private started = false;

    public constructor(
        private source: Readable,
        private transform: Transform,
    ) {
        super();

        this.passthrough = new PassThrough();

        pipeline(this.passthrough, this.transform, (error) => {
            if (error) {
                this.destroy(error);
            }
        });

        this.transform.on("data", (chunk) => this.push(chunk));
        this.transform.on("end", () => this.push(null));

        for (const stream of [this.source, this.passthrough, this.transform]) {
            stream.on("error", (error) => this.destroy(error));
        }
    }

    public override _read(size?: number): void {
        if (!this.started) {
            this.started = true;

            pipeline(this.source, this.passthrough, (error) => {
                if (error) {
                    this.destroy(error);
                }
            });
        }

        this.transform.read(size);
    }

    override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        try {
            this.source.destroy(error ?? undefined);
            this.passthrough.destroy(error ?? undefined);
            this.transform.destroy(error ?? undefined);
            /* node:coverage ignore next 3 */
        } catch (error) {
            callback(error instanceof Error ? error : new Error("Unknown error"));
        }

        callback(error);
    }
}
