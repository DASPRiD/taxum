import { Readable, type Transform } from "node:stream";

/**
 * Applies a Node.js transform to a WHATWG `ReadableStream`.
 *
 * The source stream will start being read once the transformed stream is being
 * pulled.
 */
export const applyNodeJsTransform = (
    stream: ReadableStream<Uint8Array>,
    transform: Transform,
): ReadableStream<Uint8Array> => {
    let readable: Readable | undefined;
    let transformStarted = false;

    return new ReadableStream({
        pull: (controller) => {
            if (transformStarted) {
                return;
            }

            transformStarted = true;

            const onData = (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk));
            const onEnd = () => {
                cleanup();
                controller.close();
            };
            const onError = (error: Error) => {
                cleanup();
                controller.error(error);
            };

            const cleanup = () => {
                transform.off("data", onData);
                transform.off("end", onEnd);
                transform.off("error", onError);
            };

            transform.on("data", onData);
            transform.on("end", onEnd);
            transform.on("error", onError);

            readable = Readable.fromWeb(stream);
            readable.pipe(transform);
        },
        cancel: (reason) => {
            if (readable) {
                readable.unpipe(transform);
                readable.destroy(reason);
                readable = undefined;
            }

            transform.destroy(reason);
        },
    });
};
