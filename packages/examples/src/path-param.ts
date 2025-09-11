import { pathParam } from "@taxum/core/extract";
import { createExtractHandler, m, Router } from "@taxum/core/routing";
import { serve } from "@taxum/core/server";
import { z } from "zod";

const getFoo = createExtractHandler(pathParam(z.string().regex(/[0-9]+/))).handler((foo) => {
    return `Hello ${foo}`;
});

const router = new Router().route("/:foo", m.get(getFoo));

await serve(router, {
    catchCtrlC: true,
    onListen: (address) => {
        console.info(`Listening on http://localhost:${address.port}`);
    },
});
