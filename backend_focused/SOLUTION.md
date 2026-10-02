# Fleet Maintenance — solution notes

A Django 5.2 + Django REST Framework implementation of the fleet maintenance
challenge. All nine required endpoint groups are implemented, plus a Faker-backed
seed command and 67 tests.

On top of that API there is a Next.js 16 / React 19 / MUI frontend: a fleet
dashboard, a composable vehicle search, and full CRUD for vehicles, offices,
mechanics, and maintenance records.

## Running the project

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_fleet --seed 42               # dummy data, optional but recommended
python manage.py runserver 0.0.0.0:8000
```

The API is then served from `http://localhost:8000/api/`, and DRF's browsable
interface works in a browser if you want to click around. `python manage.py
createsuperuser` additionally unlocks the Django admin at `/admin/`, which is
handy for inspecting seeded data.

### Frontend

With the backend already running on port 8000, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The UI is then at `http://localhost:3000`. It expects the API at
`http://127.0.0.1:8000/api` — the address `runserver` prints — and
`NEXT_PUBLIC_API_BASE_URL` overrides it if the backend runs elsewhere.
`npm run build` and `npm run lint` both pass clean.

The literal `127.0.0.1` is deliberate: `runserver` listens on IPv4 only, but
browsers resolve `localhost` to `::1` first, so an API URL spelled `localhost`
fails on machines that have IPv6 loopback enabled.

### Seeding

```bash
python manage.py seed_fleet --force          # rebuild from scratch
python manage.py seed_fleet --seed 42        # reproducible dataset
python manage.py seed_fleet --vehicles 500   # also: --offices, --mechanics
```

The generated data deliberately includes the cases the reporting endpoints care
about: vehicles that have never been serviced, vehicles overdue by more than a
year, retired vehicles whose plates have been reissued, and inactive mechanics.

### Tests

```bash
cd backend
python manage.py test                        # 67 tests
python manage.py test fleet.tests.test_search -v 2
```

## API reference

| Method | Path | Purpose |
| --- | --- | --- |
| CRUD | `/api/offices/` | Offices, filterable by `name` / `city` |
| GET | `/api/offices/summary/` | Per-office active vehicle count, 12-month spend, last service date |
| CRUD | `/api/vehicles/` | Vehicles; the list endpoint is also the search endpoint |
| GET | `/api/vehicles/{id}/` | Vehicle with office and complete maintenance history |
| GET | `/api/vehicles/{id}/maintenance-history/` | Paginated history, newest first |
| POST | `/api/vehicles/{id}/assign-office/` | Move a vehicle to another office |
| GET | `/api/vehicles/{id}/assignments/` | Office assignment history, newest first |
| GET | `/api/vehicles/needs-maintenance/` | Active vehicles overdue or never serviced |
| GET | `/api/vehicles/duplicate-check/` | Which of VIN / plate already belong to someone else |
| CRUD | `/api/mechanics/` | Mechanics |
| GET | `/api/mechanics/workload/` | Mechanics ranked busiest first for the current year |
| CRUD | `/api/maintenance-records/` | Maintenance records |

### Vehicle search

Every parameter is optional and composable, e.g.
`/api/vehicles/?office=3&is_active=true&make=ford&maintenance_from=2026-01-01`.

| Parameter | Behaviour |
| --- | --- |
| `office` | Exact office id |
| `is_active` | `true` / `false` |
| `make`, `model` | Case-insensitive partial match |
| `year` | Exact |
| `maintenance_from`, `maintenance_to` | Vehicle was serviced within the window |
| `mechanic_certification_number` | Vehicle was serviced by that mechanic |
| `ordering` | Any of `vin`, `license_plate`, `make`, `model`, `year`, prefix `-` to reverse |
| `page`, `page_size` | Pagination, capped at 200 per page |

The three maintenance parameters describe a **single** visit rather than three
independent ones, so combining a date window with a certification number finds
vehicles where *that mechanic* did the work *in that window*. They compile into
one `EXISTS` subquery, which keeps a vehicle from appearing once per matching
record the way a join plus `DISTINCT` would.

## Query performance

The brief calls out vehicle detail specifically, so the hot paths are all written
to run in a fixed number of queries no matter how much history exists:

- **Vehicle detail** prefetches the history with its mechanic joined in. A vehicle
  with 300 records costs 2 queries, not 301. `test_query_count_does_not_grow_with_history_size`
  pins this with `assertNumQueries`.
- **Office summary** uses three correlated subqueries rather than joined
  aggregates. Joining offices to vehicles *and* to maintenance records in one
  query fans the rows out and silently inflates the cost sum. It runs in 1 query
  regardless of office count, also pinned by a test.
- **Vehicles needing maintenance** annotates the last service date as a subquery
  and filters on it, so the database does the work rather than Python.
- Indexes cover the access patterns that matter: `(vehicle, -maintenance_date)`
  for history lookups, `(mechanic, maintenance_date)` for workload,
  `(office, is_active)` for office rollups, and `(make, model)` for search.

## Frontend

Four pages, built with Next.js 16 (App Router), React 19, MUI 7, and TanStack
Query 5 for server state:

| Page | What it does |
| --- | --- |
| `/` | Fleet totals, per-office spend rollup, overdue vehicles, mechanic workload |
| `/vehicles` | The search screen: every filter composable, plus create / edit / retire |
| `/vehicles/[id]` | Vehicle detail: lifetime spend, maintenance history, assignment history, office moves |
| `/offices`, `/mechanics` | CRUD with the spend and workload numbers alongside |

Notable decisions:

- **Filter state lives in the URL.** `/vehicles?make=ford&is_active=true` is a
  shareable, reloadable, back-button-able search, and it means the query key for
  the cache and the address bar can never disagree. Text inputs are debounced so
  typing does not push a history entry per keystroke.
- **Duplicate VINs and plates are caught while typing.** The form calls
  `duplicate-check/` against the debounced value and warns inline, rather than
  letting the user submit and bounce off a 400.
- **Server validation is rendered per field.** `parseApiError` flattens DRF's two
  error shapes into a message plus a field map, so a rejected submit highlights
  the offending input with the server's own wording. `useFieldErrors` then clears
  a message as soon as that field is edited, since the message describes a value
  that no longer exists.
- **Dialog forms are separate components mounted only while open.** That way they
  initialise from props on mount instead of syncing with an effect, which both
  reads better and satisfies React 19's `set-state-in-effect` lint rule.
- **One `AsyncSection` renders loading, error, and empty states** for every query
  on the site, so no screen silently shows a blank table.
- **Emotion's cache is wired through `AppRouterCacheProvider`.** Without it MUI's
  server-rendered style tags land in the body and the tree fails to hydrate.

## Assumptions

- **"Record only the new office assignment"** is read as *change nothing but the
  office*. `assign-office/` accepts `office` plus an optional `note`, and ignores
  anything else in the body. Reassigning a vehicle to the office it already
  occupies is a 400 rather than a silent no-op, since it almost always means the
  caller picked the wrong row.
- **Moves are auditable.** Every transfer appends a `VehicleAssignment` row, and
  creating a vehicle records the office it entered the fleet at (a row with no
  `from_office`). Editing `office` through plain CRUD is logged identically — a
  move is a move however the client makes it — so the history can never silently
  diverge from the vehicle's current office.
- **VIN uniqueness is global; plate uniqueness is scoped to active vehicles.** The
  brief says a plate "cannot be shared by two active vehicles", so retiring a
  vehicle releases its plate for reuse. This is enforced by a partial
  `UniqueConstraint`, not just in application code.
- **VINs and plates are normalised to upper case** on the way in, so `abc-123`
  and `ABC-123` are the same plate. Normalising in `to_internal_value` rather than
  `validate_<field>` matters: DRF's uniqueness validators query the database
  before field-level validators run, so a late uppercase would let a
  differently-cased duplicate through to a 500.
- **Duplicate check takes either field or both**, not strictly both, because an
  edit form usually validates one field at a time. `exclude_id` lets a vehicle
  check itself without matching its own row. A plate held by a *retired* vehicle
  is not reported as a conflict, mirroring the database constraint.
- **"Last 12 months" and "more than 365 days ago"** are both 365-day windows
  counted back from today; "current year" for mechanic workload is the calendar
  year. Dates are plain `DateField`s, so no timezone skew applies.
- **Inactive mechanics keep their history but cannot take new work.** Creating a
  record against one is a 400.
- **Maintenance dates cannot be in the future**, and cost cannot be negative
  (enforced in the serializer *and* by a database `CheckConstraint`).
- **Offices and mechanics use `on_delete=PROTECT`** so deleting one never silently
  destroys maintenance history. Deleting a vehicle *does* cascade to its records,
  since that history has no meaning without the vehicle.

## Tradeoffs

- **No authentication.** The brief lists JWT as an optional bonus and the endpoints
  are unauthenticated, as specified.
- **SQLite**, as scaffolded. Nothing in the query layer is SQLite-specific, so the
  same code runs on Postgres; the partial unique index and `CheckConstraint`
  translate directly.
- **Soft-delete via `is_active` rather than real deletion.** Fleet records are
  historical documents, so retiring is the expected operation and hard deletes are
  left available but protected.
- **Summary and workload endpoints are unpaginated**, matching the brief's example
  payload, because both are bounded dashboard-sized lists. Everything that grows
  with fleet size — search, history, the overdue list — is paginated.
- **`django-filter` added as a dependency.** The scaffold left
  `DEFAULT_FILTER_BACKENDS` empty, and the declarative filter sets are far easier
  to read and extend than hand-rolled `get_queryset` branching.
- **Money is rendered as a JSON number** (`COERCE_DECIMAL_TO_STRING = False`) to
  match the shape in the brief's example. Values are `Decimal` end to end in
  Python and the database; only the JSON rendering is a float, which is fine at
  maintenance-cost magnitudes but is the kind of thing worth revisiting for a
  financial system.
- **Settings fix.** The scaffold configured `BrowsableAPIRenderer` as the only
  renderer, which makes the API unusable from a JSON client; `JSONRenderer` is now
  first, with the browsable renderer kept for manual exploration.

## Code layout

```
backend/fleet/
  models.py       domain + database constraints and indexes
  serializers.py  validation and representation
  filters.py      declarative search filters
  selectors.py    the reporting queries, kept out of the views
  views.py        thin viewsets
  exceptions.py   ProtectedError -> 409 instead of 500
  pagination.py   client-controllable page size, capped
  management/commands/seed_fleet.py
  tests/          validation, search, reporting, detail/query-count
```

`selectors.py` exists so the aggregation logic can be read and tested without
going through HTTP, and so the views stay short enough to see at a glance.

```
frontend/
  app/            one directory per route, with its dialogs alongside the page
  components/     app shell, async/empty states, confirm dialog, snackbars
  lib/
    api.ts        one typed function per endpoint
    types.ts      request/response types mirroring the serializers
    errors.ts     DRF error bodies -> message + per-field map
    query-keys.ts cache keys in one place so invalidation stays honest
    hooks/        one module per resource, wrapping queries and mutations
```

Components never call `axios` directly; they go through a hook in `lib/hooks`,
which is also where cache invalidation lives. Renaming an office, for example,
invalidates the vehicle lists too, because vehicle rows carry the office name.
