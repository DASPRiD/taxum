import { requestId } from "@taxum/core/layer";
import { m, Router } from "@taxum/core/routing";
import { serve } from "@taxum/core/server";

const router = new Router()
    .route(
        "/",
        m.get(() => "Hello World"),
    )
    .layer(requestId.SetRequestIdLayer.default())
    .layer(requestId.PropagateRequestIdLayer.default());

await serve(router, {
    catchCtrlC: true,
    onListen: (address) => {
        console.info(`Listening on http://localhost:${address.port}`);
    },
});
