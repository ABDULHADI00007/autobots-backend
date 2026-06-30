// ============================================================
// STORAGE STARTUP VALIDATOR
// Validates AWS credentials, bucket existence, and permissions
// at server startup. Fails fast with production-safe messages.
// Never exposes credentials, bucket ARNs, or SDK internals.
// ============================================================

import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket } from "./storage.client.js";
import { StorageBucketError } from "./storage.errors.js";
import { env } from "../env.js";

/**
 * Validates the S3 bucket at startup.
 * - Skipped gracefully when S3 is not configured (development without AWS).
 * - Throws StorageBucketError with a safe message on any failure.
 *
 * @returns {Promise<void>}
 */
export async function validateStorageStartup() {
  if (!env.isS3Enabled) {
    console.warn(
      "[STORAGE] AWS S3 is not configured — storage validation skipped. " +
      "Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET to enable S3."
    );
    return;
  }

  const start = Date.now();
  console.log("[STORAGE] Validating S3 bucket access...");

  try {
    const client = getS3Client();
    const bucket = getS3Bucket();

    await client.send(new HeadBucketCommand({ Bucket: bucket }));

    const duration = Date.now() - start;
    console.log(`✓ S3 bucket validated successfully (${duration}ms)`);
  } catch (err) {
    const code  = err?.Code || err?.code || err?.name || "UNKNOWN";
    const httpStatus = err?.$metadata?.httpStatusCode;

    // Production-safe failure messages — no credentials or bucket names leaked
    let safeMessage;

    if (httpStatus === 403 || code === "AccessDenied" || code === "Forbidden") {
      safeMessage =
        "S3 bucket access was denied. Verify that the IAM credentials have s3:HeadBucket, " +
        "s3:GetObject, s3:PutObject, and s3:DeleteObject permissions on the configured bucket.";
    } else if (httpStatus === 404 || code === "NoSuchBucket" || code === "NotFound") {
      safeMessage =
        "S3 bucket was not found. Verify that AWS_S3_BUCKET is correct and the bucket exists " +
        "in the configured AWS_REGION.";
    } else if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch") {
      safeMessage =
        "S3 credentials are invalid. Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.";
    } else if (code === "RequestTimeout" || code === "NetworkingError") {
      safeMessage =
        "S3 connection timed out. Verify AWS_REGION and network connectivity.";
    } else {
      safeMessage =
        "S3 bucket validation failed. Check your AWS configuration and try again.";
    }

    console.error(`[STORAGE] Startup validation failed — ${safeMessage}`);
    throw new StorageBucketError(safeMessage);
  }
}
