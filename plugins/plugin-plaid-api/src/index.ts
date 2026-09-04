/**
 * plugin-plaid-api — Plaid integration for Aion (s147 t611 + t614 + t615 +
 * t616, REWRITTEN cycle 221 per s149 t627 + t629).
 *
 * System-level integration. Tools register globally to Aion's tool palette
 * so Aion can read bank accounts directly. MApps (Accounting Ledger /
 * Budget Tracker / Expense Reports) are secondary consumers via mini-agent
 * auto-discovery.
 *
 * Architecture (post s149 cycle 215 unification — all Plaid traffic
 * routes through Hive-ID since it's the only publicly-accessible piece
 * of the stack):
 *
 *   Aion tool call (this plugin)
 *     → Local-ID /api/proxy/plaid/<endpoint>?role=plaid-item:<itemId>
 *     → Hive-ID /api/proxy/plaid/<endpoint> (Bearer DToken)
 *     → Plaid /<endpoint>
 *     → response unwinds back
 *
 * agi never holds Plaid creds OR access_tokens — Local-ID holds only an
 * encrypted DToken that Hive-ID issued at OAuth completion. The DToken
 * is bound to a specific connection at Hive-ID; Hive-ID resolves
 * client_id+secret+access_token before calling Plaid.
 *
 * Per `feedback_localid_private_be_careful_what_ships_in_agi` — nothing
 * Plaid-specific lives in agi source.
 *
 * ADF classification: 0AGENT + 0FUNC.
 *
 * See agi/docs/agents/federation-identity.md § Plaid integration for the
 * canonical broker-pattern documentation (s149 t628 — pending).
 */

import { createPlugin, defineTool } from "@agi/sdk";

// ---------------------------------------------------------------------------
// Local-ID proxy caller
// ---------------------------------------------------------------------------

const LOCAL_ID_BASE_URL_DEFAULT = "https://id.ai.on";

async function callLocalIdProxy<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
  opts?: { role?: string },
): Promise<T> {
  const base = process.env.LOCAL_ID_BASE_URL ?? LOCAL_ID_BASE_URL_DEFAULT;
  const role = opts?.role ?? "owner";
  const url = `${base}/api/proxy/plaid/${endpoint}?role=${encodeURIComponent(role)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 404) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `No Plaid item linked for role="${role}" at ${base}. ` +
        `Connect a bank account at ${base.replace("/api/proxy/plaid", "")}/dashboard. ` +
        (text ? `Detail: ${text.slice(0, 200)}` : ""),
    );
  }

  const respText = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(respText);
  } catch {
    parsed = { raw: respText };
  }

  if (!res.ok) {
    const errBody = parsed as { error?: string; status?: number; response?: { error_message?: string; error_code?: string } };
    const upstreamMsg = errBody.response?.error_message ?? errBody.error ?? `HTTP ${res.status}`;
    const upstreamCode = errBody.response?.error_code ?? "unknown";
    const err = new Error(`Plaid ${endpoint} ${upstreamCode}: ${upstreamMsg}`);
    (err as Error & { plaidErrorCode?: string; status?: number }).plaidErrorCode = upstreamCode;
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  return parsed as T;
}

// ---------------------------------------------------------------------------
// Local-ID list-items helper — for plaid:list-accounts aggregation
// ---------------------------------------------------------------------------

interface PlaidItem {
  itemId: string;
  accountLabel: string;
  institutionId: string | null;
  connectedAt: string;
}

async function listLinkedItems(): Promise<PlaidItem[]> {
  const base = process.env.LOCAL_ID_BASE_URL ?? LOCAL_ID_BASE_URL_DEFAULT;
  const url = `${base}/api/auth/plaid-link/items`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) {
    throw new Error(
      `Failed to list Plaid items from Local-ID (HTTP ${res.status}). ` +
        `Check Local-ID is running at ${base}.`,
    );
  }
  return (await res.json()) as PlaidItem[];
}

// ---------------------------------------------------------------------------
// Plaid response types (only the fields we surface to the agent)
// ---------------------------------------------------------------------------

interface RawPlaidAccount {
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  balances?: {
    available: number | null;
    current: number | null;
    limit: number | null;
    iso_currency_code: string | null;
  };
}

interface RawPlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  date: string;
  authorized_date: string | null;
  name: string;
  merchant_name: string | null;
  category: string[] | null;
  pending: boolean;
}

interface RawPlaidIdentityOwner {
  names: string[];
  emails: Array<{ data: string; primary: boolean; type: string }>;
  phone_numbers: Array<{ data: string; primary: boolean; type: string }>;
  addresses: Array<{
    data: { street: string; city: string; region: string | null; postal_code: string | null; country: string | null };
    primary: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default createPlugin({
  async activate(api) {
    const log = api.getLogger();
    log.info("plugin-plaid-api activating — calls Local-ID proxy → Hive-ID → Plaid (s149 unified architecture)");

    // ─────────────────────────────────────────────────────────────────────
    // plaid:list-accounts — aggregates accounts across ALL linked items
    // ─────────────────────────────────────────────────────────────────────
    api.registerTool(
      defineTool(
        "plaid:list-accounts",
        "List all bank accounts linked via Plaid across every connected institution. Returns each account with its parent Plaid item id (use that in fetch-transactions / get-balance / identity-verify), name, type, subtype, last-four mask, and available balance.",
      )
        .inputSchema({
          type: "object",
          properties: {},
          additionalProperties: false,
        })
        .handler(async () => {
          const items = await listLinkedItems();
          if (items.length === 0) {
            const base = process.env.LOCAL_ID_BASE_URL ?? LOCAL_ID_BASE_URL_DEFAULT;
            return {
              accounts: [],
              note: `No banks linked yet. Connect one at ${base}/dashboard.`,
            };
          }

          const aggregated: Array<{
            itemId: string;
            institutionLabel: string;
            accountId: string;
            name: string;
            officialName: string | null;
            type: string;
            subtype: string | null;
            mask: string | null;
            availableBalance: number | null;
            currentBalance: number | null;
            isoCurrencyCode: string | null;
          }> = [];

          for (const item of items) {
            try {
              const data = await callLocalIdProxy<{ accounts: RawPlaidAccount[] }>(
                "accounts-get",
                {},
                { role: `plaid-item:${item.itemId}` },
              );
              for (const account of data.accounts) {
                aggregated.push({
                  itemId: item.itemId,
                  institutionLabel: item.accountLabel,
                  accountId: account.account_id,
                  name: account.name,
                  officialName: account.official_name,
                  type: account.type,
                  subtype: account.subtype,
                  mask: account.mask,
                  availableBalance: account.balances?.available ?? null,
                  currentBalance: account.balances?.current ?? null,
                  isoCurrencyCode: account.balances?.iso_currency_code ?? null,
                });
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              log.warn(`list-accounts: skipping item ${item.itemId}: ${message}`);
            }
          }

          return { accounts: aggregated };
        })
        .build(),
    );

    // ─────────────────────────────────────────────────────────────────────
    // plaid:fetch-transactions
    // ─────────────────────────────────────────────────────────────────────
    api.registerTool(
      defineTool(
        "plaid:fetch-transactions",
        "Fetch transactions from a linked Plaid item within a date range. Paginates automatically. Returns transactions with id, account, amount (positive=debit/expense, negative=credit/income per Plaid convention), date, merchant name, category list, and pending status.",
      )
        .inputSchema({
          type: "object",
          properties: {
            itemId: { type: "string", description: "Plaid item id (from list-accounts output)" },
            startDate: { type: "string", format: "date", description: "ISO date YYYY-MM-DD (inclusive)" },
            endDate: { type: "string", format: "date", description: "ISO date YYYY-MM-DD (inclusive)" },
            accountIds: {
              type: "array",
              items: { type: "string" },
              description: "Optional: filter to specific account_ids within the item",
            },
          },
          required: ["itemId", "startDate", "endDate"],
          additionalProperties: false,
        })
        .handler(async (input) => {
          const itemId = String(input.itemId ?? "");
          const startDate = String(input.startDate ?? "");
          const endDate = String(input.endDate ?? "");
          const accountIds = Array.isArray(input.accountIds)
            ? (input.accountIds as unknown[]).map((v) => String(v))
            : undefined;

          if (!itemId || !startDate || !endDate) {
            throw new Error("itemId, startDate, and endDate are required");
          }

          const all: RawPlaidTransaction[] = [];
          let offset = 0;
          const PAGE = 100;
          let total = Infinity;

          while (offset < total) {
            const data = await callLocalIdProxy<{
              transactions: RawPlaidTransaction[];
              total_transactions: number;
            }>(
              "transactions-get",
              {
                start_date: startDate,
                end_date: endDate,
                options: {
                  count: PAGE,
                  offset,
                  ...(accountIds ? { account_ids: accountIds } : {}),
                },
              },
              { role: `plaid-item:${itemId}` },
            );
            all.push(...data.transactions);
            total = data.total_transactions;
            offset += data.transactions.length;
            if (data.transactions.length === 0) break; // safety
          }

          return {
            count: all.length,
            transactions: all.map((t) => ({
              id: t.transaction_id,
              accountId: t.account_id,
              amount: t.amount,
              isoCurrencyCode: t.iso_currency_code,
              date: t.date,
              authorizedDate: t.authorized_date,
              name: t.name,
              merchantName: t.merchant_name,
              category: t.category,
              pending: t.pending,
            })),
          };
        })
        .build(),
    );

    // ─────────────────────────────────────────────────────────────────────
    // plaid:get-balance
    // ─────────────────────────────────────────────────────────────────────
    api.registerTool(
      defineTool(
        "plaid:get-balance",
        "Get current balances for accounts on a linked Plaid item. Returns available, current, and limit balances per account along with the ISO currency code.",
      )
        .inputSchema({
          type: "object",
          properties: {
            itemId: { type: "string", description: "Plaid item id (from list-accounts output)" },
            accountIds: {
              type: "array",
              items: { type: "string" },
              description: "Optional: filter to specific account_ids within the item",
            },
          },
          required: ["itemId"],
          additionalProperties: false,
        })
        .handler(async (input) => {
          const itemId = String(input.itemId ?? "");
          const accountIds = Array.isArray(input.accountIds)
            ? (input.accountIds as unknown[]).map((v) => String(v))
            : undefined;

          if (!itemId) throw new Error("itemId is required");

          const data = await callLocalIdProxy<{ accounts: RawPlaidAccount[] }>(
            "balance-get",
            accountIds ? { options: { account_ids: accountIds } } : {},
            { role: `plaid-item:${itemId}` },
          );

          return {
            balances: data.accounts.map((a) => ({
              accountId: a.account_id,
              name: a.name,
              available: a.balances?.available ?? null,
              current: a.balances?.current ?? null,
              limit: a.balances?.limit ?? null,
              isoCurrencyCode: a.balances?.iso_currency_code ?? null,
            })),
          };
        })
        .build(),
    );

    // ─────────────────────────────────────────────────────────────────────
    // plaid:identity-verify (KYC)
    // ─────────────────────────────────────────────────────────────────────
    api.registerTool(
      defineTool(
        "plaid:identity-verify",
        "Fetch account holder identity fields (name, email, phone, address) for accounts on a linked Plaid item. KYC use case — Plaid's Identity product is gated to certain use cases under their Service Agreement; owner is responsible for ensuring lawful use.",
      )
        .inputSchema({
          type: "object",
          properties: {
            itemId: { type: "string", description: "Plaid item id (from list-accounts output)" },
          },
          required: ["itemId"],
          additionalProperties: false,
        })
        .handler(async (input) => {
          const itemId = String(input.itemId ?? "");
          if (!itemId) throw new Error("itemId is required");

          const data = await callLocalIdProxy<{
            accounts: Array<RawPlaidAccount & { owners: RawPlaidIdentityOwner[] }>;
          }>(
            "identity-get",
            {},
            { role: `plaid-item:${itemId}` },
          );

          return {
            accounts: data.accounts.map((a) => ({
              accountId: a.account_id,
              name: a.name,
              owners: (a.owners ?? []).map((o) => ({
                names: o.names,
                emails: o.emails.map((e) => ({ value: e.data, primary: e.primary, type: e.type })),
                phones: o.phone_numbers.map((p) => ({ value: p.data, primary: p.primary, type: p.type })),
                addresses: o.addresses.map((addr) => ({ ...addr.data, primary: addr.primary })),
              })),
            })),
          };
        })
        .build(),
    );

    log.info(
      "plugin-plaid-api activated; 4 tools registered (list-accounts, fetch-transactions, get-balance, identity-verify) — calling Local-ID proxy → Hive-ID gateway → Plaid",
    );
  },
});
