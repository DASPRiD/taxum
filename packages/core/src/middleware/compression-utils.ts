import type { SupportedEncodings } from "../http/index.js";

export class AcceptEncoding implements SupportedEncodings {
    private gzip_ = true;
    private deflate_ = true;
    private br_ = true;
    private zstd_ = true;

    public gzip(): boolean {
        return this.gzip_;
    }

    public setGzip(enable: boolean): void {
        this.gzip_ = enable;
    }

    public deflate(): boolean {
        return this.deflate_;
    }

    public setDeflate(enable: boolean): void {
        this.deflate_ = enable;
    }

    public br(): boolean {
        return this.br_;
    }

    public setBr(enable: boolean): void {
        this.br_ = enable;
    }

    public zstd(): boolean {
        return this.zstd_;
    }

    public setZstd(enable: boolean): void {
        this.zstd_ = enable;
    }

    public toHeaderValue(): string | null {
        const values: string[] = [];

        if (this.gzip_) {
            values.push("gzip");
        }

        if (this.deflate_) {
            values.push("deflate");
        }

        if (this.br_) {
            values.push("br");
        }

        if (this.zstd_) {
            values.push("zstd");
        }

        return values.length > 0 ? values.join(",") : null;
    }
}
