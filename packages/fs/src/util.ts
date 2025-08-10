export const isErrnoException = (error: unknown): error is NodeJS.ErrnoException => {
    if (error instanceof Error) {
        return "errno" in error && "code" in error;
    }

    return false;
};
