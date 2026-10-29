import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { eq, or, sql, desc, and, gte } from "drizzle-orm";
import OpenAI from "openai";
import { database } from "../../db/index.js";
import { cases, events, messages } from "../../db/schema.js";
import {
  newData,
  profileInput,
  access,
  project,
  fail,
  text,
  metrics,
} from "../../shared/domain.mjs";
import { mutate } from "../../shared/workflow.mjs";
import { assistantMessages } from "../../shared/assistant.mjs";
export default async (req: Request) => {
  try {
    if (!["GET", "POST"].includes(req.method))
      return new Response("Method not allowed", { status: 405 });
    if (req.method === "POST") verifyRequestOrigin(req);
    const user = await getUser();
    if (!user)
      return Response.json({ error: "Sign in to continue." }, { status: 401 });
    const db = database(),
      url = new URL(req.url),
      route = url.pathname.split("/").pop();
    if (route === "cases" && req.method === "GET") {
      const rows = await db
        .select()
        .from(cases)
        .where(
          or(
            eq(cases.ownerId, user.id),
            ...((user.roles ?? []).includes("advisor")
              ? [eq(cases.advisorEmail, user.email!.toLowerCase())]
              : []),
            ...((user.roles ?? []).some((r) =>
              ["advisor", "specialist"].includes(r),
            )
              ? [
                  sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${cases.data}->'referrals') r WHERE r->>'recipient' = ${user.email!.toLowerCase()} AND r->>'status' IN ('Queued','Accepted','Completed'))`,
                ]
              : []),
          ),
        )
        .orderBy(desc(cases.updatedAt));
      const visible = rows.map((row) => project(row, user));
      return Response.json({
        cases: visible,
        metrics: metrics(rows.filter((r) => access(r, user) === "advisor")),
      });
    }
    if (route === "cases" && req.method === "POST") {
      const p = profileInput(await req.json());
      if (p.advisorEmail === user.email!.toLowerCase())
        fail("Choose a different account as your advisor.");
      const result = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(cases)
          .values({
            id: crypto.randomUUID(),
            ownerId: user.id,
            ownerEmail: user.email!.toLowerCase(),
            advisorEmail: p.advisorEmail,
            data: newData(p),
          })
          .onConflictDoNothing({ target: cases.ownerId })
          .returning();
        if (!row) fail("You already have a case. Refresh to open it.", 409);
        await tx.insert(events).values({
          id: crypto.randomUUID(),
          caseId: row.id,
          actorId: user.id,
          label: "Owner created a transition discovery profile",
        });
        return project(row, user);
      });
      return Response.json({ case: result }, { status: 201 });
    }
    const id = url.searchParams.get("id");
    if (!id) fail("Case ID is required.");
    if (route === "history" && req.method === "GET") {
      const [row] = await db.select().from(cases).where(eq(cases.id, id!));
      if (!row || !["owner", "advisor"].includes(access(row, user) ?? ""))
        fail("Case unavailable.", 403);
      const history = await db
        .select({
          id: events.id,
          label: events.label,
          createdAt: events.createdAt,
        })
        .from(events)
        .where(eq(events.caseId, id!))
        .orderBy(desc(events.createdAt))
        .limit(100);
      const chat = await db
        .select()
        .from(messages)
        .where(and(eq(messages.caseId, id!), eq(messages.actorId, user.id)))
        .orderBy(desc(messages.createdAt))
        .limit(100);
      return Response.json({ history, chat: chat.reverse() });
    }
    if (req.method !== "POST" || !["update", "assist"].includes(route ?? ""))
      return new Response("Not found", { status: 404 });
    const body = await req.json();
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(cases)
        .where(eq(cases.id, id!))
        .for("update");
      if (!row || !access(row, user)) fail("Case unavailable.", 403);
      if (route === "assist") {
        const mode = access(row, user);
        if (!["owner", "advisor"].includes(mode ?? ""))
          fail(
            "AI assistance is limited to the owner and assigned advisor.",
            403,
          );
        if (body.consent !== true)
          fail("Confirm sharing this case context with the AI assistant.");
        const question = text(body.question, 2000);
        if (!question) fail("Enter a question.");
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`,
        );
        const recent = await tx
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.actorId, user.id),
              gte(messages.createdAt, new Date(Date.now() - 3600000)),
            ),
          )
          .limit(20);
        if (recent.length >= 20)
          fail(
            "You have reached 20 AI requests this hour. Please try later.",
            429,
          );
        const previous = await tx
          .select({ question: messages.question, answer: messages.answer })
          .from(messages)
          .where(and(eq(messages.caseId, id!), eq(messages.actorId, user.id)))
          .orderBy(desc(messages.createdAt))
          .limit(4);
        // Ollama Cloud (OpenAI-compatible) when OLLAMA_API_KEY is set; otherwise OpenAI.
        // Keys come from the deployment's environment variables, never the repository.
        const ollamaKey = process.env.OLLAMA_API_KEY;
        const completion = await new OpenAI({
          timeout: 25000,
          maxRetries: 0,
          ...(ollamaKey
            ? {
                apiKey: ollamaKey,
                baseURL: process.env.OLLAMA_BASE_URL || "https://ollama.com/v1",
              }
            : {}),
        }).chat.completions.create({
          model:
            process.env.AI_MODEL || (ollamaKey ? "gpt-oss:120b" : "gpt-5.4-mini"),
          ...(ollamaKey
            ? { max_tokens: 1800 }
            : { max_completion_tokens: 1800, store: false }),
          messages: assistantMessages(
            row.data,
            mode!,
            question,
            previous,
          ) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        });
        const answer = completion.choices[0]?.message.content;
        if (!answer) fail("The assistant returned no answer. Try again.", 503);
        await tx.insert(messages).values({
          id: crypto.randomUUID(),
          caseId: id!,
          actorId: user.id,
          question,
          answer: answer!,
        });
        return { answer };
      }
      if (body.revision !== row.revision)
        fail(
          "This case changed in another session. Refresh before saving.",
          409,
        );
      const changed = mutate(row, user, body.op, body.payload);
      const [updated] = await tx
        .update(cases)
        .set({
          data: changed.data,
          advisorEmail: changed.data.profile.advisorEmail,
          revision: row.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(cases.id, id!))
        .returning();
      await tx.insert(events).values({
        id: crypto.randomUUID(),
        caseId: id!,
        actorId: user.id,
        label: changed.label,
      });
      // A recipient loses access immediately after declining; return no case details.
      return { case: access(updated, user) ? project(updated, user) : null };
    });
    return Response.json(result);
  } catch (e: any) {
    const trusted = e.name === "WorkflowError";
    const status = trusted ? e.status : e.status === 403 ? 403 : 503;
    return Response.json(
      {
        error: trusted
          ? e.message
          : status === 403
            ? "Request not permitted."
            : "The service could not complete this request. Please try again.",
      },
      { status },
    );
  }
};
export const config = { path: "/api/nexus/*" };
