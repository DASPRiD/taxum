import type { HttpRequest, HttpResponse } from "../http/index.js";

export type Service<T = HttpResponse> = {
    invoke: (req: HttpRequest) => Promise<T> | T;
};
