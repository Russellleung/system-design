# URL Shortener

## Scope

- Long URL → short URL.
- Short URL → redirect.
- Optional custom code.
- Optional expiry.

Not included:

- Login design.
- Edit destination.
- Analytics.
- Malware checks.

No edits means mappings never change. Caching stays simple.

## Targets

| Item | Target |
| --- | ---: |
| Stored links | 1B |
| New links | 1M/day; 60/s peak |
| Redirects | 50M/day; 3K/s peak |
| Redirect time | <100 ms |
| Read uptime | 99.99% |
| Read/write | 50:1 |

## API

```text
POST /urls
{ long_url, custom_alias?, ttl_seconds? }
→ 201 { short_url, expires_at }

GET /{code}
→ 302 Location: {long_url}
```

- `409`: custom code taken.
- `410`: expired.
- Use `302`, not `301`: keep control of expiry and disabling.
- User identity comes from the auth token, not the body.

## Data

```text
url_mapping
  code          primary key
  long_url
  created_at
  expires_at
  is_custom
```

- `code` is indexed and unique.
- Custom and generated codes share one namespace.
- Mapping is immutable.
- 1B rows ≈ 250 GB with indexes and overhead.

## Design

```text
                 ┌───────── Redis cache
Client → LB → App┤
                 └───────── Postgres primary + standby
```

### Create

1. Validate URL.
2. Get next database sequence number.
3. Encode it with digits + upper/lowercase letters.
4. Insert mapping.
5. Return short URL.

Keep a database unique constraint. Retry generated codes on conflict. Return `409` for a custom-code conflict.

### Redirect

1. Read cache.
2. On miss, read database.
3. Reject expired link.
4. Cache valid mapping.
5. Return `302`.

## Code generation

Use database sequence + Base62.

```text
Base62 = 0-9 + a-z + A-Z
6 characters = 62⁶ ≈ 56.8B codes
```

Why:

- Unique by construction.
- Short.
- Cheap.
- Durable in the database.

Avoid:

- URL prefix: frequent duplicates.
- Truncated hash: collisions at large counts.
- UUID: about 22 Base62 characters.

Sequence codes are guessable. If needed, reversibly shuffle the number before encoding.

## Cache

- Key: short code.
- Value: destination + expiry.
- Evict least recently used entries.
- Cache lifetime cannot exceed link lifetime.
- Popular links stay hot.

Cache failure:

- Fall back to database.
- Merge simultaneous misses for the same code.
- Keep a small cache inside each app instance.
- Stop excess traffic if the database is overloaded.

## Database

- Postgres is enough at this scale.
- Primary handles writes.
- Standby handles failure; may serve reads.
- Backups protect against data loss, not short outages.
- Index `expires_at` if a cleanup worker deletes old rows.

## Expiry

- Check on every read.
- Return `410` when expired.
- Cleanup later in batches.
- Correct reads do not depend on cleanup speed.

## Scale changes

| Load | Change |
| --- | --- |
| 30K reads/s | More read replicas; Redis still enough |
| 300K reads/s | Shard cache; cache popular redirects near users |
| 6K writes/s | App instances reserve blocks of IDs |
| 25 TB data | Split mappings by hash of short code |
| Global users | Cache redirects near users |

Never use Redis alone for IDs unless it is configured not to lose acknowledged increments. Keep the database uniqueness check.

## Key decisions

| Choice | Cost |
| --- | --- |
| Sequence + Base62 | Codes are predictable |
| Immutable mapping | Cannot repoint a link |
| `302` redirect | Every click reaches the service |
| Redis cache | Extra component; mass misses can hit database |
| One Postgres primary | Limited future size; simple now |

## Interview answer

Start small:

```text
App + indexed Postgres
```

Then add, in order:

1. Sequence + Base62.
2. Unique constraint.
3. Redis.
4. Standby database.
5. Expiry cleanup.
6. Larger-scale changes only when numbers require them.

Do not shard a 250 GB database or build a dedicated ID service for 60 writes/s.
