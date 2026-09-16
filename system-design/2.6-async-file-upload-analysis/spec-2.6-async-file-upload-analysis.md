# Spec 2.6: Async File Upload & Analysis Pipeline

## 1. System Objective
Design a service where authenticated users upload potentially large files (up to 200 GB), processing runs asynchronously via scalable worker pools, and users later view generated reports. The system provides **at-least-once job execution with effectively-once report publication** per tenant/file/version/config combination, supports resumable uploads, enforces strict tenant isolation, and recovers gracefully from worker crashes mid-analysis.

## 2. System Requirements

### Functional Requirements
* **Resumable Multipart Upload**: Upload files up to 200 GB via presigned multipart URLs directly to object storage, resumable after client disconnection.
* **Async Analysis Pipeline**: After upload completes, trigger analysis workers that process files in streaming/chunked fashion (no full-file memory load).
* **Report Generation & Retrieval**: Users query report status and download completed reports via presigned read URLs.
* **Malware Scan Gate**: Every uploaded file must pass malware scanning before deduplication or analysis. Infected files are quarantined and never analyzed.
* **Duplicate Prevention**: The same file content (by SHA-256 hash) must not be re-analyzed for the same tenant, analysis version, and analysis configuration. Return the existing tenant-visible report.
* **Analysis Versioning**: Support multiple analysis versions. Upgrading the analysis version produces a new report without overwriting the previous one.

### Non-Functional Requirements
* **Upload Throughput**: Support 1,000 concurrent uploads at steady state.
* **Analysis Latency**: P95 analysis completion < 10 minutes for files ≤ 1 GB. Larger files scale linearly.
* **Availability**: 99.9% for upload API; 99.95% for report retrieval.
* **Tenant Isolation**: A user must never read, list, or infer the existence of another user's files or reports.

---

## 3. Scaling & Capacity Estimation

### Traffic Model
| Metric | Value | Rationale |
| :--- | :--- | :--- |
| Registered users | 500K | Enterprise SaaS (compliance, data analytics platform) |
| DAU | 50K (10%) | Active uploaders + report consumers |
| Uploads per day | ~20K files | Mix of small (< 100 MB) and large (1–200 GB) |
| Avg file size | ~500 MB | Bimodal: many small CSVs + some large genomic/video files |
| Daily ingress | 20K × 500 MB = **~10 TB/day** | S3 PUT throughput: 3,500 PUT/sec per prefix — no bottleneck |
| Peak concurrent uploads | 1,000 | Morning burst (batch uploads from automated pipelines) |
| Active analysis jobs | ~500 concurrent | Workers process files faster than they arrive at steady state |
| Reports generated per day | ~20K | 1:1 with uploads (minus dedup hits) |
| Report storage | ~10 KB–10 MB per report (JSON/PDF) | Much smaller than source files |

### Storage Estimation
| Entity | Daily Growth | Monthly | Retention |
| :--- | :--- | :--- | :--- |
| Source files (S3) | 10 TB/day | 300 TB/month | 90 days hot (S3 Standard), then S3 Glacier (7-year regulatory) |
| Reports (S3) | ~50 GB/day | 1.5 TB/month | Indefinite (small, cheap) |
| Metadata DB (PostgreSQL) | ~20K rows/day × 500 bytes | ~300 MB/month | Indefinite |
| Upload multipart parts (S3) | Transient | Auto-cleaned by lifecycle rule after 7 days | S3 AbortIncompleteMultipartUpload lifecycle |

### Cost Estimate (AWS)
| Component | Monthly Cost (approx) | Notes |
| :--- | :--- | :--- |
| S3 Standard (300 TB hot) | ~$7,000 | $0.023/GB/month |
| S3 Glacier (archive) | ~$1,200 per 300 TB | $0.004/GB/month |
| S3 PUT/GET requests | ~$500 | 20K uploads × multipart parts |
| EC2 worker fleet (20 × c5.2xlarge) | ~$5,000 | Auto-scaled; spot instances for cost optimization |
| PostgreSQL RDS (db.r6g.xlarge) | ~$600 | Metadata, leases, dedup index, report state, and outbox |
| **Total** | **~$14,300/month** | Scales linearly with volume and worker utilization |

### Application Server Scaling (Upload Control Plane API)
* **Target Load**: 1,000 concurrent uploads.
* **Hardware**: 4-vCPU / 16 GB RAM nodes running Spring Boot.
* **Capacity**: The API does not proxy file bytes; it only signs URLs and handles metadata. A single node easily sustains ~2,000 TPS of metadata writes.
* **Nodes Needed**: Deploy 3 nodes across 3 AZs for high availability.

---

## 4. High-Level Architecture

```text
[ Authenticated Client ]
  1,000 concurrent uploads
       |
       +-- metadata: initiate/status/complete -->
       |   [ Upload Control Plane API ]
       |     3 pods across AZs
       |     4 vCPU / 16 GB RAM each
       |     no local disk; stateless
       |          |
       |          +-- upload metadata, leases, dedup rows, outbox -->
       |              [ PostgreSQL Metadata DB ]
       |                db.r6g.xlarge class
       |                4 vCPU / 32 GB RAM
       |                disk: 200 GB-1 TB gp3/io2
       |                     |
       |                     | outbox poll: ~100-500 msgs/sec capacity
       |                     v
       |              [ Outbox Publisher ]
       |                2-3 pods, 2 vCPU / 4 GB RAM each
       |                     |
       |                     v
       |              [ SQS Scan / Analysis Queues + DLQ ]
       |                managed, durable at-least-once delivery
       |                     |
       |                     v
       |              [ Scan / Analysis Workers ]
       |                base: 5 instances, max: 50
       |                8 vCPU / 16 GB RAM each
       |                temp disk: 100-500 GB only if analysis needs spill
       |                     |
       |                     +-- status updates / final report metadata --> [ PostgreSQL ]
       |
       +-- file bytes: multipart PUT directly to S3 -->
           [ S3 Raw Uploads Bucket ]
             ~300 TB/month hot data
             lifecycle: abort incomplete multipart after 7 days
                ^
                |
                | stream read; no full-file memory load
                |
           [ Scan / Analysis Workers ]
                |
                | write temp/final report objects
                v
           [ S3 Reports Bucket ]
             ~1.5 TB/month report growth
             durable report objects, presigned GET on demand
```

### Component Estimates

| Component | RPS / Throughput | CPU / RAM | Disk / Storage | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Upload Control Plane API | ~100-500 metadata RPS peak; 1,000 concurrent uploads | 3 × 4 vCPU / 16 GB | Stateless | Signs URLs, records metadata, completes uploads. Does not proxy file bytes. |
| PostgreSQL Metadata DB | ~100-500 writes/sec capacity | 4 vCPU / 32 GB | 200 GB-1 TB gp3/io2 | Upload rows, leases, dedup index, outbox, report status. |
| Outbox Publisher | ~100-500 events/sec | 2-3 × 2 vCPU / 4 GB | Stateless | Publishes scan/analysis jobs to SQS after DB commit. |
| SQS Queues | Worker backlog buffer | Managed | Managed | At-least-once delivery; DLQ after retry exhaustion. |
| Scan / Analysis Workers | ~25 concurrent jobs base, ~250 max | 5-50 × 8 vCPU / 16 GB | Optional 100-500 GB temp disk | Streams files from S3; scales from queue depth. |
| S3 Raw Uploads | ~10 TB/day ingress | Managed | ~300 TB/month hot | Source file storage, lifecycle to Glacier. |
| S3 Reports | ~20K reports/day | Managed | ~1.5 TB/month | Final reports only visible after DB completion. |

### Sequence Rates & Latency

Upload control path:

```text
Client             Upload API          PostgreSQL          S3
  |                    |                    |               |
  |-- 1. initiate ---->|                    |               | ~50-200 RPS peak, ~30-80ms
  |                    |-- insert metadata ->|              | ~5-15ms
  |                    |-- create multipart upload ---------->| ~50-150ms
  |                    |<-- presigned URLs --|               | first 100 parts
  |<-- 201 uploadId ---|                    |               | total ~100-300ms
  |                    |                    |               |
  |-- 2. PUT parts directly to S3 -------------------------->| up to 1,000 concurrent uploads
  |                    |                    |               | latency depends on file size/network
  |                    |                    |               |
  |-- 3. complete ---->|                    |               | ~20-100 RPS peak, ~100-500ms
  |                    |-- complete multipart --------------->| ~100-300ms
  |                    |-- status + outbox -->|              | ~5-20ms
  |<-- 200 completed --|                    |               | scan job durably queued
```

Analysis path:

```text
Outbox Publisher        SQS Queue          Worker             S3              PostgreSQL
      |                    |                 |                 |                    |
      |-- publish job ---->|                 |                 |                    | ~20K/day avg; burst ~100-500/sec
      |                    |-- poll msg ---->|                 |                    | worker poll ~0-20s typical
      |                    |                 |-- acquire lease ---------------------->| ~5-20ms
      |                    |                 |-- stream raw file -->|                 | minutes; size-dependent
      |                    |                 |-- write temp report ->|                | ~100ms-seconds
      |                    |                 |-- mark completed --------------------->| ~5-20ms
      |                    |<-- delete msg --|                 |                    | after DB completion
```

Report retrieval path:

```text
Client             Upload API          PostgreSQL          S3 Reports
  |                    |                    |                  |
  |-- GET report ------>|                    |                  | ~100-1,000 RPS read bursts
  |                    |-- check ownership ->|                 | ~2-10ms
  |                    |-- presign GET ------------------------>| ~10-50ms
  |<-- report URL ------|                    |                  | total ~30-100ms
  |-- download directly from S3 ------------------------------>| file-size dependent
```

### Why Direct-to-S3 Upload (Not Proxied Through App Server)?

| Approach | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- |
| **Direct S3 presigned upload** | Zero app-server bandwidth; client uploads at full network speed; no OOM risk; supports 5 TB files natively | More complex client SDK; presigned URL expiry management | ✅ **Chosen** |
| **Proxy through API server** | Simpler client; server can validate on-the-fly | Server becomes bottleneck (1 Gbps NIC limits ~125 MB/s); OOM for large files; scales poorly | ❌ Rejected for files > 100 MB |
| **tus.io resumable protocol** | Standard resumable protocol; good client ecosystem | Requires dedicated tus server; still proxies bytes through a server | ⚠️ Alternative for < 5 GB files |

### Why Presigned URLs and Not IAM Credentials?

Giving clients temporary IAM credentials (via STS) allows them to upload but also exposes S3 API surface (ListBucket, DeleteObject). Presigned URLs are scoped to a single multipart `UploadPart` operation on a specific key and upload ID with a short TTL. Minimal privilege, maximum isolation.

### Why SQS for Scan / Analysis Jobs Instead of Kafka?

Kafka can be used in this design, but the scan/analysis workload is closer to job dispatch than event streaming.

```text
Upload completed
    -> scan this file
    -> analyze this file
    -> retry if worker dies
    -> send to DLQ after too many failures
```

SQS fits this path because it provides:

* visibility timeout and redelivery if a worker crashes
* DLQ after retry exhaustion
* simple worker polling
* autoscaling from queue depth / oldest message age
* no partition planning for long-running jobs

Long file analysis jobs may run for seconds, minutes, or tens of minutes. With SQS, the worker can extend message visibility while it holds the database lease.

SQS visibility is automatic:

```text
1. Worker receives message M
2. SQS hides M from other workers for the visibility timeout
3. If worker succeeds, it calls DeleteMessage(M)
4. If worker crashes, the visibility timeout expires and SQS shows M again
```

For long-running jobs, the worker periodically calls `ChangeMessageVisibility`:

```text
ChangeMessageVisibility(M, +5 minutes)
```

This means:

```text
I am still alive and still processing this message. Do not redeliver it yet.
```

SQS has no Kafka-style offset commit. A slow message is hidden independently and does not block other workers from receiving other messages.

Kafka is better when multiple downstream systems need the same immutable upload event, replay/history is important, or the company already uses Kafka as its standard event backbone. Kafka is less natural as the direct worker queue for long-running analysis because a slow message can block progress on that partition unless the consumer immediately hands the job off elsewhere.

The common hybrid is:

```text
PostgreSQL outbox
    -> Kafka upload.completed event
    -> Kafka consumer creates SQS/job-table task
    -> workers process SQS/job-table tasks
```

For this spec, SQS is the direct job queue because the requirement is reliable background work execution, retry, and DLQ handling rather than multi-consumer event replay.

---

## 5. Upload & Analysis State Machine

```text
[ UPLOAD_INITIATED ] ---> [ UPLOADING ] ---> (No activity 24h) ---> [ UPLOAD_ABANDONED ]
                               |
                               +---> [ UPLOAD_COMPLETED ]
                                             |
                                   [ MALWARE_SCAN_QUEUED ]
                                             |
                                   [ MALWARE_SCAN_IN_PROGRESS ]
                                      /                   \
                                     v                     v
                           [ MALWARE_INFECTED ]     [ MALWARE_CLEAN ]
                                                           |
                                                 [ DEDUP_CHECK (SHA-256) ]
                                                   /                   \
                              (Hit: Duplicate)    /                     \   (Miss: New)
                                                 v                       v
                                      [ ANALYSIS_SKIPPED ]       [ ANALYSIS_QUEUED ]
                                                                         |
                                                                [ ANALYSIS_IN_PROGRESS ]
                                                                   /               \
                                                                  v                 v
                                                      [ ANALYSIS_COMPLETED ]  [ ANALYSIS_FAILED ]
                                                                                    |
                                         (Max Retries Exceeded) <-- (Retry 3x) -----+
                                                   |
                                                   v
                                        [ ANALYSIS_DEAD_LETTERED ]
```

### State Transition Latency

| Transition | Typical Latency | Driver |
| :--- | :--- | :--- |
| INITIATED → UPLOADING | < 1s | Client starts uploading immediately after receiving presigned URLs |
| UPLOADING → COMPLETED | Seconds to hours | Depends on file size and network speed (1 GB @ 100 Mbps ≈ 80s) |
| COMPLETED → MALWARE_SCAN_QUEUED | < 1s | Transactional outbox publishes scan job |
| MALWARE_SCAN → MALWARE_CLEAN | Minutes to hours | Depends on file size and scanner throughput |
| MALWARE_CLEAN → DEDUP_CHECK | < 5s | Declared client SHA-256 available; server verification may be async for large files |
| DEDUP_CHECK → QUEUED | < 1s | Durable outbox row then SQS publish |
| QUEUED → IN_PROGRESS | < 30s | SQS visibility timeout + worker poll interval |
| IN_PROGRESS → COMPLETED | < 10 min (P95 for ≤ 1 GB) | Analysis computation time |

---

## 6. Upload API & Presigned URL Flow (Java)

```java
package com.platform.upload.controller;

import java.time.Duration;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.UploadPartPresignRequest;

public record InitiateUploadRequest(
    String fileName,
    long fileSizeBytes,
    String contentType
) {}

public record InitiateUploadResponse(
    String uploadId,
    String s3UploadId,
    int totalParts,
    List<PresignedPartUrl> presignedUrls
) {}

public record PresignedPartUrl(int partNumber, String url) {}

@RestController
@RequestMapping("/v1/uploads")
public class UploadController {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final UploadMetadataRepository metadataRepo;
    private static final String BUCKET = "user-uploads";
    private static final long PART_SIZE = 100 * 1024 * 1024; // 100 MB parts

    public UploadController(S3Client s3Client, S3Presigner s3Presigner,
                            UploadMetadataRepository metadataRepo) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.metadataRepo = metadataRepo;
    }

    @PostMapping
    public InitiateUploadResponse initiateUpload(
            @RequestAttribute("userId") String userId,
            @RequestBody InitiateUploadRequest req) {

        String uploadId = "UPL_" + UUID.randomUUID();
        String s3Key = String.format("uploads/%s/%s/source.bin", userId, uploadId);

        // 1. Initiate S3 multipart upload
        CreateMultipartUploadResponse s3Response = s3Client.createMultipartUpload(
            CreateMultipartUploadRequest.builder()
                .bucket(BUCKET).key(s3Key).contentType(req.contentType())
                .serverSideEncryption(ServerSideEncryption.AES256)
                .build());

        // 2. Generate an initial window of presigned URLs.
        // For a 200 GB file this avoids returning ~2,000 URLs at once.
        int totalParts = (int) Math.ceil((double) req.fileSizeBytes() / PART_SIZE);
        int urlWindow = Math.min(totalParts, 100);
        List<PresignedPartUrl> presignedUrls = new ArrayList<>();

        for (int part = 1; part <= urlWindow; part++) {
            String url = s3Presigner.presignUploadPart(
                UploadPartPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(60))
                    .uploadPartRequest(UploadPartRequest.builder()
                        .bucket(BUCKET).key(s3Key)
                        .uploadId(s3Response.uploadId())
                        .partNumber(part).build())
                    .build()).url().toString();
            presignedUrls.add(new PresignedPartUrl(part, url));
        }

        // 3. Persist metadata
        metadataRepo.save(uploadId, userId, s3Key, s3Response.uploadId(),
            req.fileName(), req.fileSizeBytes(), totalParts, "UPLOAD_INITIATED");

        return new InitiateUploadResponse(uploadId, s3Response.uploadId(), totalParts, presignedUrls);
    }

    @PostMapping("/{uploadId}/complete")
    public Map<String, String> completeUpload(
            @RequestAttribute("userId") String userId,
            @PathVariable String uploadId,
            @RequestBody List<CompletedPart> completedParts) {

        var metadata = metadataRepo.findByIdAndUserId(uploadId, userId)
            .orElseThrow(() -> new IllegalArgumentException("Upload not found"));

        validateCompletedParts(metadata, completedParts);

        // Complete S3 multipart upload
        s3Client.completeMultipartUpload(CompleteMultipartUploadRequest.builder()
            .bucket(BUCKET).key(metadata.s3Key()).uploadId(metadata.s3UploadId())
            .multipartUpload(CompletedMultipartUpload.builder().parts(completedParts).build())
            .build());

        // Guarded state transition + durable outbox row in one DB transaction.
        // Duplicate complete calls return 0 rows and do not enqueue duplicate jobs.
        metadataRepo.markUploadCompletedAndEnqueueScan(uploadId, userId);

        return Map.of("status", "UPLOAD_COMPLETED", "uploadId", uploadId);
    }
}
```

`GET /uploads/{id}/parts?from=101&to=200` refreshes presigned URLs for the next missing part range. The service stores the original filename in metadata only; S3 object keys use generated IDs to avoid leaking user-provided filenames.

### Resuming a 200 GB Upload After Client Disconnection

S3 multipart upload is inherently resumable:
1. Each 100 MB part is an independent PUT request with its own presigned URL
2. Client tracks which parts succeeded (S3 returns ETag per part)
3. On reconnection, client calls `GET /uploads/{id}/status` which returns the list of confirmed parts
4. Client re-uploads only missing parts using fresh presigned URLs (re-generated for remaining parts)
5. Server metadata still tracks ownership, expected part count, expected size, object key, upload status, and expiry. S3 tracks uploaded parts natively via `ListParts`, but it does not replace tenant workflow state.

**Why 100 MB part size?**
| Part Size | # Parts for 200 GB | Tradeoff |
| :--- | :--- | :--- |
| 10 MB | 20,000 | Too many presigned URLs to generate; hits S3 10,000-part limit |
| 100 MB | 2,000 | Good balance: each part uploads in ~8s on a 100 Mbps connection. Failure wastes at most 8s of work. |
| 1 GB | 200 | Fewer parts, but each takes 80s. A failure wastes 80s. Not ideal for mobile/unreliable connections. |

The 100 MB / 8 second estimate assumes `100 Mbps`, which is megabits per second, not megabytes per second:

```text
100 MB = 800 megabits
100 Mbps = 100 megabits/sec
800 megabits / 100 megabits/sec = 8 seconds
```

Equivalently:

```text
100 Mbps = 12.5 MB/sec
100 MB / 12.5 MB/sec = 8 seconds
```

If the client has a `100 MB/sec` connection, then the same part takes about:

```text
100 MB / 100 MB/sec = 1 second
```

---

## 7. Duplicate Analysis Prevention

### Deduplication Strategy

```text
[ Upload Completed ]
         |
         v (Compute S3 Object SHA-256)
[ Lookup: SELECT report_id
          WHERE tenant_id = ?
            AND file_hash = ?
            AND analysis_version = ?
            AND analysis_config_hash = ? ]
         |
    +----+----+
    |         |
 (Hit)     (Miss)
    |         |
    v         v
 [ Skip ]  [ Queue to SQS ]
```

### How SHA-256 Is Computed Without Loading the Entire File

```java
// Stream S3 object in 8 MB chunks, update MessageDigest incrementally
public String computeS3ObjectHash(String bucket, String key) {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    try (var s3Stream = s3Client.getObject(GetObjectRequest.builder()
            .bucket(bucket).key(key).build())) {
        byte[] buffer = new byte[8 * 1024 * 1024]; // 8 MB buffer
        int bytesRead;
        while ((bytesRead = s3Stream.read(buffer)) != -1) {
            digest.update(buffer, 0, bytesRead);
        }
    }
    return Hex.encodeHexString(digest.digest());
}
// For 200 GB file: ~25,000 iterations × ~100ms/read ≈ ~40 minutes
// Optimization: compute hash client-side during upload, then verify server-side.
```

**Why not use S3 ETag as the hash?** S3 ETag for multipart uploads is `MD5-of-part-MD5s`, not a hash of the file content. It depends on part size and count, so the same file uploaded with different part sizes produces different ETags. SHA-256 of the full content is deterministic.

For large files, the client computes SHA-256 while uploading and submits the declared hash on completion. The server stores it as `declared_sha256` and verifies it asynchronously by streaming from S3. A report is not reused for dedup until the hash is verified.

Deduplication is tenant-scoped to avoid cross-tenant information leaks:

```text
dedup_key = tenant_id + file_sha256 + analysis_version + analysis_config_hash
```

Global cross-tenant dedup is intentionally avoided in the base design. It can reveal that another tenant uploaded the same content.

### Preventing Double-Job from Event + Completion Call Race

**Problem**: Duplicate client `POST /complete` calls, retries, or object-storage notifications can otherwise create two downstream jobs for the same file.

**Solution**: The system does NOT use S3 events as the analysis trigger. Only the guarded `POST /complete` transition creates the durable scan outbox row, inside a `@Transactional` block that atomically sets `status = UPLOAD_COMPLETED` with a `WHERE status IN ('UPLOAD_INITIATED', 'FINALIZING')` guard. A second call sees `status = UPLOAD_COMPLETED` and is a no-op.

```sql
UPDATE uploads SET status = 'UPLOAD_COMPLETED'
WHERE id = ? AND user_id = ?
  AND status IN ('UPLOAD_INITIATED', 'FINALIZING')
RETURNING id;
-- Returns 0 rows on duplicate call -> no duplicate outbox row
```

The database owns the application workflow state, but S3 owns the object state. `CompleteMultipartUpload` and the database transaction are not atomic together, so recovery checks S3 before deciding whether to retry or advance the DB state:

```text
DB = FINALIZING, S3 HeadObject = exists
    -> complete already succeeded; mark UPLOAD_COMPLETED and insert outbox row

DB = FINALIZING, S3 HeadObject = missing
    -> complete did not finish; retry CompleteMultipartUpload or ask client to retry

DB = UPLOAD_COMPLETED, outbox row unpublished
    -> outbox publisher retries; no user action required
```

---

## 8. Worker Architecture & Scaling

### Worker Design

```java
@Component
public class AnalysisWorker {

    @SqsListener(queueNames = "analysis-queue", maxConcurrentMessages = "5")
    public void processAnalysis(AnalysisEvent event) {
        // 1. Acquire lease (set status = IN_PROGRESS with worker_id and lease_expiry)
        boolean leaseAcquired = metadataRepo.tryAcquireLease(
            event.uploadId(), workerId, Duration.ofMinutes(30));
        if (!leaseAcquired) return; // Another worker already processing

        try {
            Report report;

            // 2. Stream file from S3 in chunks (no full-file memory load)
            try (var s3Stream = s3Client.getObject(...)) {
                leaseHeartbeat.start(event.uploadId(), workerId);
                report = analyzeStream(s3Stream); // Streaming analysis
            }

            // 3. Write report to a temporary key first
            String tempReportKey = reportKey + ".tmp." + workerId;
            s3Client.putObject(tempReportKey, report.toBytes());

            // 4. Atomically publish report metadata after the object write succeeds
            metadataRepo.markAnalysisCompleted(event.uploadId(), tempReportKey, reportKey);
        } catch (RetryableException e) {
            metadataRepo.resetToQueued(event.uploadId(), workerId, e.getMessage());
            // Re-throw so SQS redelivers according to retry policy
            throw e;
        } catch (Exception e) {
            metadataRepo.updateStatus(event.uploadId(), "ANALYSIS_FAILED", e.getMessage());
            // After 3 retries, SQS routes to DLQ
        }
    }
}
```

### Worker Scaling Strategy

| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| Base worker count | 5 instances (c5.2xlarge: 8 vCPU, 16 GB) | Handles steady-state ~2K analyses/day |
| Max worker count | 50 instances | Peak burst capacity |
| Scale trigger | SQS `ApproximateNumberOfMessages` > 100 for 2 min | Queue depth reflects backlog |
| Scale-down trigger | Queue empty for 10 min | Avoid premature scale-down (analyses take minutes) |
| Concurrency per worker | 5 concurrent analyses | CPU-bound analysis on 8 cores = ~5 parallel jobs |
| Spot instances | 80% spot + 20% on-demand | 60–70% cost savings; SQS retry handles spot termination |
| Visibility timeout | 5 minutes, extended by heartbeat | Large files can exceed 30 minutes. Workers extend SQS visibility and DB lease while processing. |

Workers scale with completed-file analysis workload, not directly with upload bandwidth. S3 and SQS buffer the system:

```text
Client upload rate -> S3 raw bucket
Completed uploads  -> SQS jobs
Workers            -> drain SQS jobs
```

Sizing formula:

```text
required concurrent analyses = file arrival rate × average processing time
required worker instances    = required concurrent analyses / concurrency per worker
```

Example using the traffic model:

```text
20,000 uploads/day
= 20,000 / 86,400
≈ 0.23 completed files/sec average
```

If each analysis takes 10 minutes:

```text
0.23 files/sec × 600 sec
≈ 138 concurrent analyses
```

With 5 concurrent analyses per worker instance:

```text
138 / 5
≈ 28 worker instances
```

The base fleet can be lower because traffic is not evenly distributed and dedup/skipped analyses reduce work. The autoscaler watches SQS queue depth and oldest message age; if the queue grows, add workers, and if it drains, scale down.

### Lease Mechanism (Preventing Duplicate Processing)

There are two layers of leasing:

```text
SQS visibility timeout = queue-level temporary hide
DB lease               = durable job ownership guard
```

They solve different problems.

SQS visibility prevents most duplicate work while a worker is actively processing:

```text
ReceiveMessage hides the message.
DeleteMessage removes it after success.
If the worker dies, SQS makes it visible again after timeout.
```

The DB lease is the correctness layer. It decides which worker is allowed to publish the report:

```text
Only the worker holding the unexpired DB lease can mark analysis completed.
```

This is needed because SQS is at-least-once. A message can be redelivered, visibility can expire during a long job, or a worker can crash after writing a temp report. The DB lease prevents two workers from publishing two final reports for the same upload.

```sql
UPDATE analyses
SET status = 'IN_PROGRESS',
    worker_id = ?,
    lease_expires_at = NOW() + INTERVAL '30 minutes'
WHERE upload_id = ?
  AND (
      status = 'ANALYSIS_QUEUED'
      OR (status = 'ANALYSIS_IN_PROGRESS' AND lease_expires_at < NOW())
  )
RETURNING upload_id;
```

If a worker crashes mid-analysis:
1. Worker stops extending SQS visibility and DB lease
2. SQS message becomes visible after the last visibility extension expires
3. New worker picks it up and can acquire the expired `IN_PROGRESS` lease directly
4. Stale lease sweeper remains as defense-in-depth and requeues jobs if SQS delivery is missed

Reports are published safely:

```text
write report to reports/{tenant_id}/{upload_id}/{analysis_version}/tmp/{worker_id}
verify write succeeded
update DB report row to COMPLETED with final visible report key
optionally copy/rename temp object to final key or treat DB final key as source of truth
```

Users only receive presigned report URLs after the DB row is `ANALYSIS_COMPLETED`, so they never see partial reports.

---

## 9. Tenant Authorization & Security

### Authorization Model

```text
[ Client (JWT) ] ---> [ API Gateway ] ---> [ Upload Service (Extract user_id) ]
                                             /               \
                                            /                 \
                                           v                   v
                     [ S3 (uploads/{user_id}/...) ]    [ PostgreSQL (WHERE user_id = ?) ]
```

| Security Control | Implementation | Why |
| :--- | :--- | :--- |
| **S3 key prefix isolation** | `uploads/{userId}/{uploadId}/source.bin` | Presigned URLs scoped to user's prefix and generated object key. Even if URL leaks, it only accesses that user's path. |
| **DB-level row filtering** | Every SQL query includes `WHERE user_id = ?` (no admin bypass in application) | Defense-in-depth against IDOR (Insecure Direct Object Reference) |
| **Presigned URL scoping** | Each URL is a signed multipart `UploadPart` on a specific key, upload ID, and part number; no wildcard access | User cannot list or delete other objects |
| **Encryption at rest** | S3 SSE-S3 (AES-256) default; SSE-KMS for regulated data | Compliance (SOC 2, HIPAA) |
| **Encryption in transit** | TLS 1.3 enforced on all endpoints + S3 bucket policy denying HTTP | Prevents MITM |
| **Malware scanning** | Dedicated ECS/EC2 scanner workers stream from S3 before dedup/analysis | Prevent processing malicious files. Lambda/ClamAV is not appropriate for 200 GB files. Quarantine to isolated bucket if infected. |
| **Report access** | Presigned GET URLs with 15-min TTL, scoped to `reports/{userId}/` | Time-limited, user-scoped read access |

---

## 10. Failure Points & Recovery

| Failure | Impact | Detection | Recovery | RTO |
| :--- | :--- | :--- | :--- | :--- |
| **Client disconnects mid-upload** | Partial multipart upload in S3 | Client tracks uploaded parts | Client resumes: `GET /uploads/{id}/status` returns confirmed parts → re-upload missing parts only | Instant resume |
| **Browser page refresh during upload** | Browser usually loses the in-memory `File` object, but the server-side multipart upload is still valid | Frontend finds persisted `uploadId`, file name, size, last modified time, and part size in IndexedDB/localStorage | UI asks user to select the same file again, verifies name/size/lastModified or lightweight chunk hash, calls `GET /uploads/{id}/status`, then resumes missing part numbers using fresh presigned URLs for the same `s3UploadId` and object key | User-dependent; upload resumes without re-sending completed parts |
| **All parts uploaded but client never calls `POST /complete`** | S3 has uploaded multipart parts, but no final object and no analysis job | Upload row remains `UPLOAD_INITIATED`; server can compare expected parts with S3 `ListParts` during status/sweeper checks | Client retry calls `POST /complete`. If the client never returns, sweeper marks the upload `ABANDONED` after expiry; S3 lifecycle aborts incomplete multipart parts after 7 days. Optional product choice: sweeper may auto-complete only if all expected parts and ETags are known and trusted. | Client retry instant; abandoned cleanup automatic |
| **`CompleteMultipartUpload` succeeds but DB/outbox update fails** | Final S3 object exists, but DB may still show `FINALIZING`/`UPLOAD_INITIATED`; analysis not queued yet | Sweeper finds stale finalizing uploads and calls S3 `HeadObject` | If `HeadObject` finds the object, run the guarded DB transaction to set `UPLOAD_COMPLETED` and insert the outbox row. Operation is idempotent. | < 10min sweeper interval |
| **DB marks `UPLOAD_COMPLETED` but outbox event not published to SQS** | Upload is complete but scan/analysis is delayed | Outbox row remains unpublished or stale; sweeper checks completed uploads with no scan job | Outbox publisher retries until SQS accepts. Because status update and outbox row are in the same DB transaction, there is no committed `UPLOAD_COMPLETED` state without a durable outbox row. | Usually seconds; < 10min with sweeper |
| **S3 multipart upload abandoned** | Orphaned parts consuming storage | S3 lifecycle rule: `AbortIncompleteMultipartUpload` after 7 days | Automatic cleanup; no manual intervention | Automatic |
| **Worker crash mid-analysis** | SQS message re-delivered; temp report may exist in S3 | DB lease heartbeat stops; SQS visibility timeout expires | New worker acquires expired lease and starts fresh. Temp reports are ignored until DB marks a final report as completed. | < 10min typical |
| **Worker OOM on large file** | Analysis fails | JVM OOM error logged; container restarts | Workers MUST use streaming processing (8 MB buffer), never load full file. If analysis inherently requires random access: use memory-mapped file from EBS-backed temp disk, not heap. | < 5min (restart + re-queue) |
| **SQS message lost** (extremely rare) | Scan or analysis never triggered | Sweeper job finds stale states with no outbox/SQS progress and re-publishes | Sweeper is the defense-in-depth safety net. Runs every 10 min. | < 70min |
| **SHA-256 hash collision** | Two different files treated as identical → wrong report returned | Probability: $< 10^{-38}$ for SHA-256 | Effectively impossible. For paranoid mode: store file size alongside hash; compare both. | N/A |
| **Analysis version/config upgrade** | Old reports must remain accessible; new version/config must not overwrite | Version and config hash are part of the dedup key: `(tenant_id, file_hash, analysis_version, analysis_config_hash)` | New version/config produces a new report. Old reports remain queryable. | By design |
| **Presigned URL expires before upload completes** | Part upload fails with `403 Forbidden` | Client detects 403 on PUT | Client calls `POST /uploads/{id}/refresh-urls` to get fresh presigned URLs for remaining parts. Original `s3UploadId` is reused. | Instant |
| **Malware detected in uploaded file** | File quarantined; analysis blocked | Scanner worker returns `INFECTED` status | Update metadata to `QUARANTINED`. Notify user. Do not dedup or analyze. Ops can review quarantine bucket. | File-size dependent |

---

## 11. Metrics, Tracing & Observability

### Key Metrics

| Metric | Type | Alert Threshold |
| :--- | :--- | :--- |
| `upload.initiated.count` | Counter | Informational — demand signal |
| `upload.completed.count` | Counter | < 70% of initiated (30%+ abandon rate) → UX investigation |
| `upload.size_bytes` | Histogram | Informational — capacity planning |
| `upload.duration_seconds` | Histogram | P95 > 10min for files < 1 GB → network issue |
| `analysis.queue.depth` | Gauge (SQS) | > 500 for 5min → scale up workers |
| `analysis.queue.age_seconds` | Gauge (oldest msg) | > 600s (10min) → queue draining too slowly |
| `analysis.duration_seconds` | Histogram (by file size bucket) | P95 > 30min for ≤ 1 GB → worker perf regression |
| `analysis.dedup.hit_rate` | Gauge (%) | Informational — ROI of dedup logic |
| `analysis.failure_rate` | Gauge (%) | > 5% → P2 alert |
| `analysis.dlq.count` | Counter | > 0 → P3 ops investigation |
| `worker.lease.stale_count` | Counter | > 0 → workers crashing; investigate OOM/spot termination |
| `malware.scan.infected_count` | Counter | > 0 → P2 security alert |
| `s3.orphaned_multipart.count` | Gauge | > 1,000 → lifecycle rule not firing |

### Distributed Tracing

```
[traceId: upl-abc123]
  [span: upload.initiate]                    ← 50ms (creates metadata + presigned URLs)
  [span: upload.part_put × N]               ← client-side (not server-traced)
  [span: upload.complete]                    ← 200ms (S3 CompleteMultipart + outbox row)
    [span: s3.complete_multipart]            ← 150ms
    [span: outbox.enqueue_scan_job]          ← 5ms
  [span: analysis.dedup_check]              ← 40s–40min (SHA-256 streaming)
    [span: s3.get_object_stream]
    [span: hash.sha256_compute]
    [span: db.dedup_lookup]                  ← 2ms
  [span: analysis.process]                  ← 1–30min
    [span: s3.stream_read]                   ← (tag: bytes_processed)
    [span: analysis.compute]                 ← (tag: analysis_version)
    [span: s3.write_report]                  ← 100ms
    [span: db.update_status]                 ← 5ms
```

---

## 12. Self-Evaluation Checklist
- [x] **Upload Architecture**: Direct S3 multipart with presigned URLs, resumable after disconnection.
- [x] **State Machine**: 10-state lifecycle covering upload, dedup, analysis, failure, and dead-letter.
- [x] **Duplicate Prevention**: SHA-256 content hash + analysis version as dedup key, with double-job race prevention.
- [x] **Worker Scaling**: SQS-driven auto-scaling (5–50 instances), lease mechanism, spot instance support.
- [x] **Streaming Processing**: 8 MB chunked reads, no full-file memory load, memory-mapped fallback for random access.
- [x] **Tenant Isolation**: S3 prefix + DB row filter + scoped presigned URLs + encryption.
- [x] **Failure Points & Recovery**: 9 failure modes with detection, recovery, and RTO.
- [x] **Metrics & Tracing**: Upload funnel, queue health, worker performance, and security metrics.
