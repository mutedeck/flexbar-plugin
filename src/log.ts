import { logger } from "@eniac/flexdesigner";

/** The SDK types its logger as nullable, but it is always created when the module loads. */
export const log = logger!;
