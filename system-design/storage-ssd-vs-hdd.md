# Storage Tiering: SSD vs HDD Architecture

When designing scalable distributed systems, selecting the appropriate physical storage medium is critical for both performance (latency) and financial cost efficiency. Modern architectures almost universally split data across two primary mediums: **Solid State Drives (SSDs)** for active workloads and **Hard Disk Drives (HDDs)** for analytics and archival.

## 1. The Physics of the Drives (Random vs. Sequential I/O)

The primary reason we stratify workloads stems from how the physical hardware retrieves data.

* **HDD (Hard Disk Drive):** Inside an HDD is a physical metal platter spinning at high speeds (e.g., 7200 RPM) and a mechanical robotic arm that must swing across the disk to read/write data blocks. Because of this moving mechanical arm, "Seek Time" (the time to randomly find a scattered piece of data) is extremely slow—typically taking **~10 milliseconds**.
* **SSD (Solid State Drive):** An SSD (especially modern NVMe) uses NAND flash memory chips with absolutely zero moving parts. Randomly searching for a scattered piece of data via electrical signals takes **~0.1 milliseconds** (100 microseconds). 

When querying data **randomly**, an SSD is roughly **100x faster** than a mechanical Hard Drive.

## 2. When to Use SSDs (The "Hot" Tier)

**Workloads:** OLTP (Online Transaction Processing), Primary Databases, Fast Message Brokers.
**Technologies:** PostgreSQL, MySQL, Redis (Disk AOF/Snapshots), Kafka (depending on retention).

* **The "Why":** In a digital wallet, e-commerce site, or ticketing platform, user traffic patterns are extremely random. User A logs in, User M checks their balance, and User Z inserts a new order. Under the hood, the database is constantly jumping around its internal B-Tree indexes performing heavily scattered "Random Reads" and "Random Writes". 
* If you run a high-traffic PostgreSQL primary database on an HDD, the mechanical arm spends all its time wildly thrashing back and forth, dragging queries down and severely limiting your peak Transactions Per Second (TPS). NVMe SSDs effortlessly absorb high-concurrency scattered I/O.

## 3. When to Use HDDs (The "Cold" Tier)

**Workloads:** OLAP (Online Analytical Processing), Data Lakes, Archival, Batch Processing.
**Technologies:** Hadoop (HDFS), AWS S3 Standard/Glacier, Columnar File Stores, Historical Log Dumps.

* **The "Why":** While HDDs are terrible at retrieving data randomly, they are incredibly efficient at **Sequential** reading. If you need to read a massive 500 GB Analytics Parquet file from start to finish (e.g. for a Machine Learning training run), the mechanical arm simply drops down once and reads the spinning track linearly. 
* **The Cost Advantage:** HDDs are massively cheaper per terabyte than SSDs. You do not want to pay premium NVMe prices to store 7-year-old regulatory compliance logs that nobody reads.

## 4. Modern Architecture: The Tiered Data Strategy

The golden rule of large-scale system design is utilizing a **Tiered Storage Architecture** to guarantee sub-millisecond query speeds for active users while saving exponential amounts of money on historical footprint.

**Example Fintech Tiering Strategy:**
1. **The "Hot" Tier (NVMe SSD):** The recent 90 days of financial transactions sit in a blazingly fast PostgreSQL database running on premium AWS `io2` or `gp3` SSD volumes. This hardware delivers the strict 50ms P99 latency guarantees to the mobile app.
2. **The "Cold" Tier (HDD):** Every night, an automated data-pipeline job sweeps all transactions older than 90 days out of PostgreSQL, compresses them into Columnar Parquet format, and drops them into an AWS S3 bucket. Under the hood, S3 is backed by massive racks of cheap spinning HDDs inside the AWS datacenter. 

This hybrid approach ensures the frontend CRUD API stays incredibly fast, constrains expensive SSD disk usage to a rolling 90-day window, and safely persists the full 7-year regulatory history for backend Data Analysts to churn through sequentially.
