import { pathParams } from "@taxum/core/extract";
import { handler, m, Router } from "@taxum/core/routing";
import { serve } from "@taxum/core/server";
import { z } from "zod";

const getFoo = handler(
    [
        pathParams(
            z.object({
                foo: z.string().regex(/[0-9]+/),
            }),
        ),
    ],
    (params) => {
        return `Hello ${params.foo}`;
    },
);

const router = new Router().route("/:foo", m.get(getFoo));

await serve(router, {
    catchCtrlC: true,
    onListen: (address) => {
        console.info(`Listening on http://localhost:${address.port}`);
    },
});
