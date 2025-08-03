import { m, Router } from "@taxum/core/routing";
import { serve } from "@taxum/core/server";

const subRouter = new Router().route(
    "/",
    m.get(() => "Hello Sub Router"),
);

const router = new Router().nest("/sub", subRouter);

await serve(router, {
    catchCtrlC: true,
    onListen: (address) => {
        console.info(`Listening on http://localhost:${address.port}`);
    },
});
