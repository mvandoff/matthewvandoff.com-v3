# last.fm data via a scheduled fetch

The Terminal's music data comes from JSON files in v3's S3 bucket, served through the site's CloudFront distribution like any other static asset. A scheduled Lambda writes those files: it fetches recent tracks from last.fm every minute and top lists about every 6 hours, and writes a file only when its content has changed. There is no request-time proxy, so the site stays fully static, there is no public endpoint to protect, and the API key stays in SSM Parameter Store. If last.fm fails, the last good file stays up, and the Terminal shows it with its age instead of an error. The cost is that last.fm gets called even when nobody visits, about 1,700 calls a day. That is allowed under the API terms, and the AWS cost is effectively $0: Lambda is in the always-free tier, and S3 writes are cents a month.

## Considered options

- **Calling last.fm from the browser.** last.fm's CORS headers allow it, but the key would be public and there would be no caching.
- **A Lambda per request behind CloudFront at `/api/music/…`.** It runs nothing when nobody visits, but it is no cheaper, and it degrades worse: a slow first visit after a quiet spell, and visible errors once the cached response has expired.
- **Fetching at build time.** Fine for top lists, but now playing would be stale until the next deploy.
