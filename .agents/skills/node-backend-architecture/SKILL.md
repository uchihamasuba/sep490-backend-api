---
name: node-backend-architecture
description: Stack-agnostic blueprint for structuring a Node.js / TypeScript backend as layered feature modules — routes → controller → service → data layer — with conventions for errors, validation, config, DTOs, auth, and cross-cutting concerns. Use when scaffolding a NEW Node.js backend, standardizing or refactoring an existing one's folder/layer structure, adding a feature module, or reviewing backend architecture. Framework-agnostic (Express, Fastify, Koa, NestJS) and database-agnostic (SQL or NoSQL, any ORM/driver). For a repo that has its OWN stack-specific architecture skill, prefer that one.
---

# Node.js backend — modular architecture blueprint

A portable convention for building a Node.js/TypeScript backend as **layered feature modules**. Keep the *layers and their roles* fixed; swap the *tools* (HTTP framework, DB, validation lib) to fit the project. Works in JS too — drop the type annotations. When a rule and an existing neighboring file disagree, match the neighbor and flag the drift.

The whole idea in one sentence: **thin edges, fat services, isolated data access, one place for each cross-cutting concern.**

## Directory layout (`src/`)
```
app.ts              HTTP app assembly: middleware chain → mount router → error handlers (ORDER MATTERS)
server.ts           Bootstrap: init external resources (DB, cache…) then start listening; graceful shutdown
routes.ts           Root router — mounts every feature module under its path prefix
config/             env.ts (validated at boot), db.ts, one file per external service (cache, storage, mailer…)
middleware/         auth.ts, role.ts, validate.ts, error.ts, notFound.ts, rateLimit.ts
models/ | db/       Data layer — one entity/table per file (ODM schema, or a repository wrapping the ORM)
modules/<feature>/  Feature slice: <feature>.routes.ts, .controller.ts, .service.ts, .validators.ts
utils/              AppError.ts, asyncHandler.ts, response.ts (ok/created), logger.ts, + small helpers
types/              shared types; framework request augmentation (e.g. attach the auth principal)
```
Group by **feature** (a `modules/orders/` slice), never by technical type across the whole app (no global `controllers/` + `services/` + `models/` mega-folders). Everything about one feature lives together.

## The four layers — strict, one direction: routes → controller → service → data

**1. routes** (`<feature>.routes.ts`) — declare endpoints + attach middleware. Nothing else. Apply shared middleware (auth) once at the top.
```ts
const router = Router()
router.use(requireAuth)                                    // once, for the whole module
router.post('/', validate(createOrderSchema), c.create)
router.get('/:id', c.get)
router.patch('/:id', validate(updateOrderSchema), c.update)
router.delete('/:id', requireRole('admin'), c.remove)
export default router
```
Then register in `routes.ts`: `api.use('/orders', orderRoutes)`.

**2. controller** (`<feature>.controller.ts`) — thin adapter. Read values off the request, call ONE service function, send the response. NO business logic, NO data access, NO try/catch.
```ts
import * as svc from './order.service'
export const create = asyncHandler(async (req, res) => {
  created(res, await svc.createOrder(req.user!.id, req.body))
})
export const get = asyncHandler(async (req, res) => {
  ok(res, await svc.getOrder(req.user!.id, req.params.id))
})
```

**3. service** (`<feature>.service.ts`) — ALL business logic + data access. Pure functions of primitives / DTO input; never touch `req`/`res`. Throw `AppError` for expected failures. Return DTOs (never raw DB rows). This is the only layer that talks to the data layer.
```ts
export async function createOrder(ownerId: string, input: CreateOrderInput) {
  const product = await Products.findById(input.productId)
  if (!product) throw AppError.notFound('Product not found')
  if (product.stock < input.qty) throw AppError.badRequest('Not enough stock')
  const order = await Orders.create({ owner: ownerId, product: product.id, qty: input.qty })
  void events.emit('order.created', order.id)              // side effects: fire-and-forget
  return toOrderDTO(order)
}
```

**4. data layer** (`models/` or `db/` + `repositories/`) — entity/schema definitions and the queries against them. Keep raw driver/ORM calls out of controllers and (ideally) behind a repository so services read declaratively. Two common shapes:
- **ODM (Mongo/Mongoose, etc.):** the model *is* the data access — `Orders.find(...)`.
- **SQL + query builder / ORM (Prisma, Drizzle, Knex, TypeORM):** a thin `orders.repo.ts` exposing `findById`, `create`, … so the service never inlines SQL.
Either way: define the entity in ONE file, and map to a DTO before returning (see below).

## Conventions (all stack-agnostic)

**Response envelope** — one consistent shape via helpers; never hand-roll `res.json`.
- success: `ok(res, data, meta?, status=200)` → `{ success: true, data, meta? }`; `created(res, data)` → 201.
- action/delete endpoints: `ok(res, { message: '…' })`.

**Errors** — a single `AppError` class carrying `{ status, code, message, details? }`, thrown anywhere, caught by ONE error middleware (registered LAST). That middleware also translates framework/validation/DB errors (schema errors → 400, unique-constraint → 409, bad-id/cast → 400) and hides internals in production. Never build an error response by hand in a controller/service.
```ts
throw AppError.notFound('…')     // 404
throw AppError.forbidden('…')    // 403
throw new AppError(409, 'CONFLICT', '…')
```

**Async safety** — wrap async route handlers so a thrown error reaches the error middleware (an `asyncHandler` HOF, or the framework's built-in async support in Fastify/Nest). Do NOT scatter `try/catch { next(err) }` in controllers.

**Validation** — validate + coerce at the edge with a schema (Zod / Joi / Yup / class-validator) via a `validate(schema, 'body'|'query'|'params')` middleware; reassign the parsed value back onto the request so handlers read clean, typed data. Export inferred types (`z.infer`) and reuse them as the service input type. Business rules that need DB lookups stay in the service, not the schema.

**Auth & authorization** — middleware only. `requireAuth` verifies the token and attaches the principal to the request (`req.user = { id, role }`); `requireRole(...)`/`requirePermission(...)` gate by role/scope; a tenant/workspace guard attaches tenant context. Apply `requireAuth` once per module via `router.use`.

**Ownership / multi-tenant scoping** — every query is scoped by `{ owner }` or `{ tenantId }`; never trust `req.params.id` alone — always `findOne({ id, owner })`. For billing or resource-bound side effects, resolve the **resource owner**, not the acting user (an admin acting on someone's resource is not that resource's owner); pass the actor separately for audit only.

**DTOs** — never leak internal or sensitive fields (`_id`/`__v`, password hashes, tokens, storage keys, raw joins). Map every entity to a DTO at the boundary (a `toXDTO()` function, an ODM `toJSON` transform, or an ORM `select`). The HTTP shape is a deliberate contract, not "whatever the row looks like."

**Config / env** — one validated module (`config/env.ts`) parses `process.env` against a schema at boot and fails fast on missing/invalid values. Import `env`/`isProd` from there; NEVER read `process.env` anywhere else.

**Logging** — a structured logger (pino/winston), error object first: `logger.warn({ err }, 'message')`. Pick one language for user-facing/log messages and keep it consistent.

**Cross-cutting side effects** — call shared helpers, don't reinvent per feature: `audit(...)`, `notify(...)`, `events.emit(...)`. One implementation, reused.

**Background / heavy work** — never block the response on it. Fire-and-forget for best-effort (`void doThing()`), or push to a queue (BullMQ/SQS) for anything heavy, retryable, or that must survive a crash. Break circular imports with a lazy/dynamic import at the call site.

**Idempotency** — webhook and event handlers must be safe to run twice: guard with a check-and-return (`if (tx.status === 'paid') return`). Re-entrant mutations use the same pattern.

**Style** — consistent indentation/quotes; `<feature>.<layer>.ts` filenames; PascalCase entities; one export style per layer (`export const` handlers, `export async function` service fns). Match the file you're editing over any global preference.

## Recipe: add an authenticated feature `things`
1. **Data layer** — `models/Thing.ts` (or `db/things.repo.ts`): entity + indexes on `owner` and hot fields.
2. **Validators** — `modules/things/thing.validators.ts`: schemas + inferred input types.
3. **Service** — `modules/things/thing.service.ts`: logic; scope every query by owner/tenant; throw `AppError`; return DTOs.
4. **Controller** — `modules/things/thing.controller.ts`: `asyncHandler`, one service call each, `ok`/`created`.
5. **Routes** — `modules/things/thing.routes.ts`: `router.use(requireAuth)`, endpoints with `validate(...)` + role gates.
6. **Register** — `routes.ts`: `api.use('/things', thingRoutes)`.
7. **Verify** — typecheck/lint clean; add a test or smoke script.

## Do / Don't
- DO keep controllers one line of logic; push every `if`/query into the service.
- DO throw `AppError`; DON'T `res.status(...).json({ error })` by hand.
- DO return DTOs; DON'T return raw DB rows or leak `_id`/secrets.
- DO scope every query by owner/tenant; DON'T trust an id from params without an ownership filter.
- DON'T read `process.env` outside `config/`; DON'T put logic in routes/controllers; DON'T block a request on email/AI/exports — enqueue it.
- DON'T group by technical type across the app; keep each feature's layers together in its module folder.

## Adapting to your stack (keep the layers, swap the tools)
| Concern | Reference | Alternatives |
|---|---|---|
| HTTP framework | Express (`Router`, middleware, `asyncHandler`) | Fastify (plugins + schemas), NestJS (module/controller/provider — same 4 layers, DI-wired), Koa |
| Data layer | ODM model (Mongoose) | Prisma / Drizzle / Knex / TypeORM behind a `*.repo.ts` |
| Validation | Zod + `validate` middleware | Joi, Yup, class-validator (Nest) |
| Response/errors | `ok`/`created` + `AppError` + error middleware | Fastify error handler + serializer; Nest exception filters |
| Config | zod-validated `env.ts` | envalid, convict, `@nestjs/config` |

NestJS note: its `@Module`/`@Controller`/`@Injectable()` provider map exactly onto routes/controller/service; validation is DTO decorators, errors are exception filters. The *shape* of this blueprint is unchanged — only the wiring differs.
