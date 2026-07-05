export const isErrnoException = (error: unknown): error is NodeJS.ErrnoException => {
    if (error instanceof Error) {
        return "errno" in error && "code" in error;
    }

    return false;
};

/**
 * Node rejects filesystem paths containing a NUL byte with a `TypeError` that
 * carries no `errno`, so it is not an {@link isErrnoException}. Such a path can
 * only originate from a malformed request, so we treat it as not found.
 */
export const isInvalidPathError = (error: unknown): boolean =>
    error instanceof TypeError && "code" in error && error.code === "ERR_INVALID_ARG_VALUE";
