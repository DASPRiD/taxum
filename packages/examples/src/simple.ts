import { m, Router } from "@taxum/core/routing";
import { serve } from "@taxum/core/server";

const router = new Router().route(
    "/",
    m.get(() => "Hello World"),
);

await serve(router, {
    catchCtrlC: true,
    onListen: (address) => {
        console.info(`Listening on http://localhost:${address.port}`);
    },
});
