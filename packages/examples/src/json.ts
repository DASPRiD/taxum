import { json } from "@taxum/core/extract";
import { extractHandler, m, Router } from "@taxum/core/routing";
import { serve } from "@taxum/core/server";
import { z } from "zod";

const createFoo = extractHandler(
    json(
        z.object({
            foo: z.string(),
        }),
    ),
    (body) => {
        return `Hello ${body.foo}`;
    },
);

const router = new Router().route("/", m.post(createFoo));

await serve(router, {
    catchCtrlC: true,
    onListen: (address) => {
        console.info(`Listening on http://localhost:${address.port}`);
    },
});
