# Submission Tracker — Solution Notes

A workspace for reviewing broker-submitted opportunities: a filterable list that
maps entirely onto the URL, and a detail view with the full relational context
for one submission.

## Running it

Two servers. The backend first, from `frontend_focused/backend`:

```bash
python -m venv .venv
.venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_submissions      # add --force to rebuild
python manage.py runserver 0.0.0.0:8000
```

Then the frontend, from `frontend_focused/frontend`:

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the root redirects to `/submissions`.

Run the backend tests with `python manage.py test` (57 tests). The frontend is
checked with `npm run lint`, `npx tsc --noEmit` and `npm run build`.

The API base URL defaults to `http://localhost:8000/api`, as the challenge
README specifies, and can be overridden with `NEXT_PUBLIC_API_BASE_URL` in
`frontend/.env.local`. On a Windows host where `localhost` resolves to IPv6
`::1` before IPv4, requests fail with an unexplained "Failed to fetch" because
`runserver` listens on IPv4; setting the override to `http://127.0.0.1:8000/api`
fixes it.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/submissions/` | Paginated list with related counts and a preview of the newest note |
| `GET /api/submissions/<id>/` | One submission with its contacts, documents and notes |
| `GET /api/brokers/` | Brokers for the filter dropdown, unpaginated |

List parameters, all optional and all composable:

`status`, `priority`, `brokerId`, `ownerId`, `companySearch`, `createdFrom`,
`createdTo`, `hasDocuments`, `hasNotes`, `page`, `pageSize`, `ordering`.

`ordering` accepts `createdAt`, `company`, `broker`, `owner`, `status`,
`priority`, `documentCount`, `noteCount`, `latestNoteAt`, each optionally
prefixed with `-`.

The endpoints are read-only. The data arrives from brokers and is reviewed
elsewhere, so there is nothing for this workspace to write, and adding writes
would mean inventing the authentication and audit story the brief leaves out.

## How the backend is organised

Querysets live in `submissions/selectors.py`, filters in
`submissions/filters/`, and the viewsets stay thin. That keeps the query work
in one place where its cost is visible and testable, instead of spread across
view methods.

**The list runs in a fixed two queries** regardless of page size: one `COUNT`
for pagination and one for the page. The counts and the latest-note preview are
annotations rather than attribute access, because reading `submission.notes` per
row is what turns a 10-row page into 21 queries. Two details are easy to get
wrong here:

- The counts use `distinct=True`. Joining documents and notes in a single query
  multiplies the rows, so a plain `Count` reports `documents x notes` for both
  columns rather than the real totals. There is a test for this.
- `latest_note` comes from correlated subqueries ordered by `-created_at, -id`.
  Prefetching every note to read the first one would load thousands of rows to
  display one line each.

**The detail view runs in four queries** — the submission plus one prefetch per
collection — so a submission with hundreds of notes costs the same as one with
three. Both guarantees are pinned by `assertNumQueries` tests that add rows and
assert the count has not moved.

Smaller decisions worth naming:

- `hasDocuments` / `hasNotes` filter with `EXISTS` rather than a join, which
  would duplicate rows and then need `distinct()` to paper over it.
- `createdFrom` / `createdTo` compare on the date part of the timestamp.
  Comparing against the datetime would make `createdTo=2026-10-02` mean
  "midnight that day" and silently drop everything submitted during it.
- Ordering by `priority` sorts by urgency, not alphabetically — the raw column
  would order high, low, medium. Ascending puts High first, which is the
  direction someone triaging actually wants.
- Any applied ordering appends `-id` as a tie-breaker. None of the sortable
  columns are unique, and without a deterministic order rows can repeat or
  vanish between pages. There is a test that pages a set of identical statuses
  and asserts no row appears twice.
- An unknown `status` returns 400 rather than being ignored, because a filter
  that silently returns everything looks like a filter that does nothing.
- Responses are marked `no-store`. Without a `Cache-Control` header the browser
  may heuristically cache these GETs and show a stale version of a submission.

## How the frontend is organised

```
app/submissions/page.tsx          list route
app/submissions/[id]/page.tsx     detail route
components/submissions/           filters, table, detail sections
components/common/                status chips, empty and error states
lib/submission-filters.ts         URL <-> filter state <-> API params
lib/hooks/useSubmissionFilters.ts binds that state to the router
```

**The URL is the only source of truth for list state.** Filters, sorting,
paging and page size all live in the query string, so a filtered view can be
bookmarked, shared with a colleague, reloaded, or reached with the back button,
and the component tree never holds a second copy that can drift. The conversion
in both directions is pure functions in `lib/submission-filters.ts`, which
keeps parsing and validation out of the React layer.

Specific UX decisions:

- **Only non-default values are written to the URL**, so the common case stays a
  clean `/submissions` rather than a URL restating every default.
- **Incoming parameters are validated, not trusted.** An unknown status or a
  malformed date in a hand-edited URL is dropped rather than sent to the API to
  come back as a 400.
- **Changing a filter resets to page 1.** Page 7 of an unfiltered list is page 7
  of nothing once a filter lands.
- **The search box is debounced** and updates the URL once the user pauses, so
  typing does not fire a request and a history entry per keystroke. Navigation
  uses `replace`, so a session of filter tweaking leaves one history entry
  instead of twenty.
- **The previous page stays on screen while the next loads**
  (`placeholderData: keepPreviousData`), with a thin progress bar above the
  table. The alternative — collapsing to a spinner on every keystroke — makes
  the table flicker and the layout jump.
- **Active filters are shown as removable chips** with a count, so a surprising
  result count never looks like missing data.
- **Empty states distinguish the two cases.** No matches for the current filters
  is a dead end the user created, and it offers to clear them; an empty database
  is a different message pointing at the seed command.
- **Errors are shown in place** with the reason and a retry, not a toast that
  disappears before it can be read. A failed request with no response says the
  Django server is probably not running, which is the most likely cause in local
  development; a 404 on the detail page says the submission does not exist and
  offers no pointless retry.
- **Opening a row preserves the list view.** The row link carries the list's
  query string as `returnTo`, so "Back to submissions" returns to the same
  filters, page and sort rather than a reset list.
- **Relative times with absolute tooltips.** "6 days ago" is the useful reading
  for triage; the exact timestamp is one hover away.

## Tradeoffs and assumptions

- **Read-only API, as above.** The detail page has no "add note" affordance for
  the same reason.
- **Data fetching is client-side.** React Query owns caching, retries and
  background refetching, and the list's behaviour is driven by the query string
  it already reads on the client. Server-rendering the first page would improve
  first paint, at the cost of either duplicating the fetch logic or wiring up
  hydration boundaries for state that changes on nearly every interaction.
- **`companySearch` matches the legal name, industry and headquarters city.**
  Searching only the name is more literal, but someone typing "Chicago" or
  "Manufacturing" is looking for those submissions, so the broader match is the
  more useful behaviour. It is `icontains`, which is fine at this size; a larger
  dataset would want a trigram index or full-text search.
- **Brokers are returned unpaginated** because they populate a single dropdown.
  At a few hundred brokers this should become a searchable autocomplete against
  a paginated endpoint.
- **SQLite and `CORS_ALLOW_ALL_ORIGINS`** are inherited from the scaffold and
  are development-only settings.
- **No frontend test runner is configured** in the scaffold. Rather than add one
  and a testing stack to it, the test effort went into the backend, where the
  query-count and filter guarantees are the things most likely to regress
  silently. `lib/submission-filters.ts` is written as pure functions partly so
  those are straightforward to cover if a runner is added.

## Changes to provided files

Three scaffold files needed fixing to get a working setup, called out here since
they were not mine:

- **`backend/requirements.txt`** was a full environment freeze including `lxml`,
  `pikepdf`, `pillow`, `greenlet`, `msgpack` and `pynvim`. None are imported by
  this project and several have no wheels for current Python versions, so
  `pip install -r requirements.txt` failed before installing anything. It now
  lists the six direct dependencies and their pinned transitive ones.
- **`backend/submissions/management/commands/seed_submissions.py`** set
  `Document.uploaded_at` during `bulk_create`, but that field is `auto_now_add`,
  so every document was stamped with the current time and the "Uploaded" column
  showed today's date for all of them. The intended timestamps are now written
  back after the insert. Notes and documents are also clamped to the present,
  since offsetting from a recent `created_at` otherwise produced records dated
  in the future, which the UI reported as "in 2 days".
- **`frontend/prettier.config.mjs`** now sets `endOfLine: 'auto'`. The checked-in
  files use CRLF, so on a Windows checkout Prettier's default flagged every line
  of every file — including untouched config files — and `npm run lint` failed
  with hundreds of errors.

`@mui/material-nextjs` was added as a dependency. Its `AppRouterCacheProvider`
is what keeps Emotion's server and client styles in agreement; without it the
App Router emits styles the client does not match and React reports a hydration
mismatch on every page.

## Stretch goals implemented

- Sortable columns on every meaningful field, including the annotated counts and
  latest-note timestamp, with urgency-ordered priority and stable pagination.
- Date-range, `hasDocuments` and `hasNotes` filters beyond the required
  `status`, `brokerId` and `companySearch`.
- Client-controlled page size, capped server-side so a stray `pageSize=100000`
  cannot ask the database for everything.
- Removable active-filter chips and a filtered-versus-empty distinction.
- `returnTo` round-tripping so the detail page can restore the list exactly.
- 57 backend tests, including query-count regression guards on both endpoints.
