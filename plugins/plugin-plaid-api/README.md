# plugin-plaid-api

System-level Plaid integration for Aionima. Registers 4 agent tools globally
to Aion's tool palette so Aion can read bank accounts directly. MApps
(Accounting Ledger / Budget Tracker / Expense Reports) are secondary
consumers via mini-agent auto-discovery.

## Architecture (s149 cycle 215 unification)

All Plaid traffic routes through **Hive-ID** — the only publicly-accessible
piece of the Aionima stack. Local-ID (`id.ai.on`) is LAN-only DNS and cannot
satisfy Plaid's public-HTTPS callback / webhook requirements.

```
Aion tool call (this plugin)
  → Local-ID /api/proxy/plaid/<endpoint>?role=plaid-item:<itemId>
  → Hive-ID /api/proxy/plaid/<endpoint>  (Bearer DToken)
  → Plaid /<endpoint>
  → response unwinds back
```

| Repo | Role |
|------|------|
| `agi-hive-id` | OAuth dance (Plaid Link widget), `client_id`+`secret` storage, DToken issuance, Plaid proxy gateway |
| `agi-local-id` | Encrypted DToken storage (`connections` table), forwarding routes to Hive-ID |
| `agi-marketplace` (this plugin) | 4 tool definitions; calls Local-ID proxy; never holds Plaid creds |

**agi + Local-ID never see** `PLAID_CLIENT_ID`, `PLAID_SECRET`, or raw
`access_token` values. Only Hive-ID holds them. This plugin forwards via
DToken (a scoped, revocable 32-byte bearer that Hive-ID maps to the full
credential set at call time).

See `agi/docs/agents/federation-identity.md` § Plaid integration for the
canonical architecture description.

## Setup

1. **Deploy Hive-ID** and configure `PLAID_CLIENT_ID` + `PLAID_CLIENT_SECRET`
   + `PLAID_ENV` in Hive-ID's environment (Railway / Azure / Docker).
2. **Connect a bank account** via Local-ID's dashboard at `id.ai.on/dashboard`
   → "Connect Bank Account" (runs Plaid Link widget in-browser; exchanges
   public token at Hive-ID; DToken stored in Local-ID's connections table).
3. **Aion (and MApp mini-agents) can now call the 4 Plaid tools** directly.

## Tools

| Tool | Inputs | Description |
|------|--------|-------------|
| `plaid:list-accounts` | (none) | Aggregates accounts across all linked items. Returns each account with its parent `itemId`, name, type, subtype, mask, and balances. |
| `plaid:fetch-transactions` | `{itemId, startDate, endDate, accountIds?}` | Paginated transaction fetch. Returns id, amount (positive=debit), date, merchant name, category, pending status. |
| `plaid:get-balance` | `{itemId, accountIds?}` | Current available, current, and limit balances per account with ISO currency. |
| `plaid:identity-verify` | `{itemId}` | Account holder names / emails / phones / addresses (KYC). |

Mini-agents in the Accounting / Budget Tracker / Expense Reports MApps can
auto-discover these tools via `toolMode=auto` dispatch without explicit
per-MApp tool whitelisting.

## ADF classification

`0AGENT + 0FUNC`:

- **0AGENT**: extends Aion's tool palette globally with 4 Plaid actions
- **0FUNC**: external-data integration that any tool consumer (Aion direct,
  MApp mini-agents, Workflows) can call through the registered tools
