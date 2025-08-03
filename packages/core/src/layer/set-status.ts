import type { StatusCode } from "../http/index.js";
import type { Layer } from "../routing/index.js";

/**
 * A layer that sets a specific HTTP status code to the response.
 */
export const setStatusLayer = (status: StatusCode): Layer => ({
    layer: (inner) => async (req) => {
        const response = (await inner(req)).toOwned();
        response.status = status;
        return response;
    },
});
