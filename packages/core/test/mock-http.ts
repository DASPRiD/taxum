import http from "node:http";
import type { AddressInfo } from "node:net";
import net from "node:net";

type CreateIncomingMessageOptions = {
    headers?: Record<string, string>;
};

export function createIncomingMessage(
    options?: CreateIncomingMessageOptions,
): http.IncomingMessage {
    const message = new http.IncomingMessage(new net.Socket());
    message.httpVersion = "1.1";
    message.httpVersionMajor = 1;
    message.httpVersionMinor = 1;
    message.method = "GET";

    if (options?.headers) {
        const distinct: Record<string, string[]> = {};

        for (const [key, value] of Object.entries(options.headers)) {
            const lower = key.toLowerCase();
            message.headers[lower] = value;
            distinct[lower] = [value];
        }

        Object.defineProperty(message, "headersDistinct", { value: distinct });
    }

    return message;
}

export async function callRequestHandler(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>,
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
    const server = http.createServer(handler);

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    try {
        const response = await fetch(`http://127.0.0.1:${port}`);
        const body = Buffer.from(await response.arrayBuffer());
        const headers: Record<string, string> = {};

        for (const [key, value] of response.headers) {
            headers[key] = value;
        }

        return { status: response.status, headers, body };
    } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}
