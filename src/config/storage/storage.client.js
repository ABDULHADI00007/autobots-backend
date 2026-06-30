// ============================================================
// STORAGE CLIENT
// Single S3 client instance for the entire application.
// No other module may instantiate an S3 client directly.
// Supports AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces,
// and any S3-compatible provider via optional endpoint config.
// ============================================================

import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../env.js";
import { StorageConfigError } from "./storage.errors.js";

// ============================================================
// LAZY SINGLETON
// ============================================================

let _client = null;

/**
 * Returns the shared S3Client instance, creating it on first call.
 * Throws StorageConfigError if S3 is not configured.
 */
export function getS3Client() {
  if (_client) return _client;

  if (!env.isS3Enabled) {
    throw new StorageConfigError(
      "AWS S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET."
    );
  }

  const clientConfig = {
    region: env.AWS_REGION,
    credentials: {
      accessKeyId:     env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  };

  // Support S3-compatible providers (Cloudflare R2, MinIO, DigitalOcean Spaces, etc.)
  if (env.AWS_S3_ENDPOINT) {
    clientConfig.endpoint = env.AWS_S3_ENDPOINT;
  }

  if (env.AWS_S3_FORCE_PATH_STYLE) {
    clientConfig.forcePathStyle = true;
  }

  _client = new S3Client(clientConfig);

  console.log(
    `[STORAGE] S3 client initialized — region=${env.AWS_REGION}` +
    (env.AWS_S3_ENDPOINT ? ` endpoint=${env.AWS_S3_ENDPOINT}` : "")
  );

  return _client;
}

/**
 * Returns the configured bucket name.
 * Throws StorageConfigError if not set.
 */
export function getS3Bucket() {
  if (!env.AWS_S3_BUCKET) {
    throw new StorageConfigError("AWS_S3_BUCKET is not configured.");
  }
  return env.AWS_S3_BUCKET;
}

/**
 * Resets the singleton — used only in tests.
 * @internal
 */
export function _resetS3ClientForTesting() {
  _client = null;
}
