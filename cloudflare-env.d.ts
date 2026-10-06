declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    INSTAGRAM_ENCRYPTION_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
