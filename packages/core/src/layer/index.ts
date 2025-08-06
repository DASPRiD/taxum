/**
 * Common layers used in HTTP servers.
 *
 * @packageDocumentation
 */

import * as clientIp from "./client-ipr.js";
import * as compression from "./compression.js";
import * as cors from "./cors/index.js";
import * as decompression from "./decompression.js";
import * as limit from "./limit.js";
import * as requestId from "./request-id.js";
import * as setStatus from "./set-status.js";

// We cannot do `export *` on each member as some IDEs struggle to find those
// exported namespaces.
export { clientIp, compression, cors, decompression, limit, requestId, setStatus };
