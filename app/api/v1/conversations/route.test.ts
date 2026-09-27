import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { resolveAuthDual } from "@/lib/api/auth-dual";
import { comNomeDoAtendente } from "@/lib/users/com-nome-do-atendente";
import { listConversationsHandler } from "./_handler";

vi.mock("@/lib/api/auth-dual", () => ({ resolveAuthDual: vi.fn() }));
vi.mock("@/lib/users/com-nome-do-atendente", () => ({
  comNomeDoAtendente: vi.fn(async (conversations: unknown) => conversations),
}));
vi.mock("./_handler", () => ({
  listConversationsHandler: vi.fn(async () => ({
    conversations: [],
    cursor: null,
    has_more: false,
  })),
}));

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const TOKEN_ID = "33333333-3333-4333-8333-333333333333";
const FAKE_ADMIN_CLIENT = { admin: true } as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveAuthDual).mockResolvedValue({
    ok: true,
    organizationId: ORG_ID,
    actor: { type: "api_token", id: TOKEN_ID, role: "agent" },
    supabase: FAKE_ADMIN_CLIENT,
    via: "token",
  });
});

describe("GET /api/v1/conversations — leitura server-to-server", () => {
  it("aceita Bearer read-only e passa organização/ator do token ao handler", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/v1/conversations?limit=1", {
      headers: { authorization: "Bearer dsk_redacted_fixture" },
    });

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(resolveAuthDual).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        resource: "conversations",
        role: "viewer",
        scope: "mcp:read",
      }),
    );
    expect(listConversationsHandler).toHaveBeenCalledWith(
      FAKE_ADMIN_CLIENT,
      expect.objectContaining({
        organization_id: ORG_ID,
        actor: expect.objectContaining({ type: "api_token", id: TOKEN_ID }),
      }),
      expect.objectContaining({ limit: 1 }),
    );
    expect(comNomeDoAtendente).toHaveBeenCalledWith([]);
  });

  it("encerra com a resposta do autenticador quando o Bearer é recusado", async () => {
    vi.mocked(resolveAuthDual).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false }), { status: 401 }),
    });
    const { GET } = await import("./route");

    const res = await GET(
      new NextRequest("http://localhost/api/v1/conversations", {
        headers: { authorization: "Bearer dsk_invalid_fixture" },
      }),
    );

    expect(res.status).toBe(401);
    expect(listConversationsHandler).not.toHaveBeenCalled();
  });
});
