/**
 * Default preflight request headers:
 *
 * - origin
 * - access-control-request-method
 * - access-control-request-headers
 */
export const PREFLIGHT_REQUEST_HEADERS = [
    "origin",
    "access-control-request-method",
    "access-control-request-headers",
];

export const ANY = Symbol("Any");
export const MIRROR_REQUEST = Symbol("Mirror Request");
