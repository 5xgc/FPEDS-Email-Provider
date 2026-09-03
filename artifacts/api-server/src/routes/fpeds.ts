import { Router, type IRouter, type Request, type Response } from "express";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
} from "drizzle-orm";
import {
  db,
  folders,
  messages,
  notifications,
  sessions,
  subscriptions,
  users,
} from "@workspace/db";
import {
  CreateFolderBody,
  CreateSubscriptionBody,
  SendMessageBody,
  SignInBody,
  SignUpBody,
  UpdateMessageBody,
  UpdateProfileBody,
} from "@workspace/api-zod";
import {
  decryptValue,
  encryptValue,
  hashAccessKey,
  newId,
} from "../lib/fpeds-security";

const router: IRouter = Router();
const SESSION_COOKIE = "fpeds_session";
const SESSION_DAYS = 30;
const DOMAIN = "fpeds.jo3.org";

type AuthenticatedRequest = Request & { fpedsUserId?: string };

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

function validUsername(username: string): boolean {
  return username.length >= 1 && /[a-z]/i.test(username);
}

function accessKeyIsValid(accessKey: string): boolean {
  return /^[0-9]{50}$/.test(accessKey.trim());
}

function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    emailChangesRemaining: user.emailChangesRemaining,
  };
}

function publicMessage(message: typeof messages.$inferSelect) {
  return {
    id: message.id,
    folder: message.folder,
    from: decryptValue(message.encryptedFrom),
    to: decryptValue(message.encryptedTo),
    subject: decryptValue(message.encryptedSubject),
    preview: decryptValue(message.encryptedBody).slice(0, 140).replace(/\s+/g, " "),
    body: decryptValue(message.encryptedBody),
    receivedAt: message.receivedAt,
    isRead: message.isRead,
    isStarred: message.isStarred,
    spamScore: message.spamScore,
    blocked: message.blocked,
  };
}

function getSessionExpiry() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

async function createSession(userId: string, response: Response) {
  const sessionId = newId();
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt: getSessionExpiry(),
  });
  response.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

async function loadUser(request: Request) {
  const sessionId = request.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!sessionId) return null;
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId)))
    .limit(1);
  const row = rows[0];
  if (!row || row.session.expiresAt.getTime() < Date.now()) return null;
  return row.user;
}

async function requireUser(request: AuthenticatedRequest, response: Response) {
  const user = await loadUser(request);
  if (!user) {
    response.status(401).json({ error: "Sign in required" });
    return null;
  }
  request.fpedsUserId = user.id;
  return user;
}

async function classifySpam(subject: string, body: string): Promise<number> {
  const heuristic = /winner|urgent|wire transfer|crypto|password reset|claim now|free money/i.test(
    `${subject}\n${body}`,
  )
    ? 0.92
    : 0.04;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return heuristic;
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0,
        max_tokens: 10,
        messages: [
          {
            role: "system",
            content:
              "Return only a number from 0 to 1. It is the probability an email is spam. Do not explain.",
          },
          { role: "user", content: `Subject: ${subject}\n\n${body.slice(0, 4000)}` },
        ],
      }),
    });
    if (!response.ok) return heuristic;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const score = Number(payload.choices?.[0]?.message?.content?.match(/0?\.\d+|1(?:\.0+)?/)?.[0]);
    return Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : heuristic;
  } catch {
    return heuristic;
  }
}

async function notify(userId: string, title: string, message: string, kind: string) {
  await db.insert(notifications).values({
    id: newId(),
    userId,
    kind,
    encryptedTitle: encryptValue(title),
    encryptedMessage: encryptValue(message),
  });
}

router.post("/auth/signup", async (request, response) => {
  const parsed = SignUpBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Use a 50-digit access key and a username with at least one letter." });
    return;
  }
  const accessKey = parsed.data.accessKey.trim();
  const username = normalizeUsername(parsed.data.username);
  if (!accessKeyIsValid(accessKey) || !validUsername(username)) {
    response.status(400).json({ error: "Use a 50-digit access key and a username with at least one letter." });
    return;
  }
  const existing = await db
    .select()
    .from(users)
    .where(or(eq(users.accessKeyHash, hashAccessKey(accessKey)), eq(users.username, username)))
    .limit(1);
  if (existing[0]) {
    response.status(409).json({ error: "That access key or username is already in use." });
    return;
  }
  const currentYear = new Date().getUTCFullYear();
  const user = {
    id: newId(),
    accessKeyHash: hashAccessKey(accessKey),
    username,
    email: `${username}@${DOMAIN}`,
    emailChangesRemaining: 2,
    emailChangeYear: currentYear,
  };
  await db.insert(users).values(user);
  await Promise.all([
    db.insert(folders).values([
      { id: newId(), userId: user.id, name: "inbox" },
      { id: newId(), userId: user.id, name: "sent" },
      { id: newId(), userId: user.id, name: "drafts" },
      { id: newId(), userId: user.id, name: "spam" },
    ]),
    db.insert(messages).values({
      id: newId(),
      userId: user.id,
      folder: "inbox",
      encryptedFrom: encryptValue("hello@fpeds.jo3.org"),
      encryptedTo: encryptValue(user.email),
      encryptedSubject: encryptValue("Welcome to FPEDS"),
      encryptedBody: encryptValue(
        "Your private inbox is ready. Send your first message from the compose button, and use folders to keep important mail close.",
      ),
      isRead: false,
    }),
    notify(user.id, "Welcome to FPEDS", "Your private mailbox is ready.", "welcome"),
  ]);
  await createSession(user.id, response);
  response.status(201).json({ user: publicUser(user as typeof users.$inferSelect), firstLogin: true });
});

router.post("/auth/signin", async (request, response) => {
  const parsed = SignInBody.safeParse(request.body);
  if (!parsed.success || !accessKeyIsValid(parsed.data.accessKey)) {
    response.status(401).json({ error: "Access key rejected." });
    return;
  }
  const matching = await db
    .select()
    .from(users)
    .where(eq(users.accessKeyHash, hashAccessKey(parsed.data.accessKey.trim())))
    .limit(1);
  if (!matching[0]) {
    response.status(401).json({ error: "Access key rejected." });
    return;
  }
  await createSession(matching[0].id, response);
  response.json({ user: publicUser(matching[0]), firstLogin: false });
});

router.post("/auth/signout", async (request, response) => {
  const sessionId = request.cookies?.[SESSION_COOKIE] as string | undefined;
  if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
  response.clearCookie(SESSION_COOKIE);
  response.status(204).send();
});

router.get("/auth/me", async (request, response) => {
  const user = await loadUser(request);
  if (!user) {
    response.status(401).json({ error: "Sign in required" });
    return;
  }
  response.json(publicUser(user));
});

router.patch("/auth/profile", async (request: AuthenticatedRequest, response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const parsed = UpdateProfileBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Username must include at least one letter." });
    return;
  }
  const username = normalizeUsername(parsed.data.username);
  if (!validUsername(username)) {
    response.status(400).json({ error: "Username must include at least one letter." });
    return;
  }
  const currentYear = new Date().getUTCFullYear();
  const changesRemaining =
    user.emailChangeYear === currentYear ? user.emailChangesRemaining : 2;
  const changing = username !== user.username;
  if (changing && changesRemaining <= 0) {
    response.status(400).json({ error: "You have used both email address changes for this year." });
    return;
  }
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username)))
    .limit(1);
  if (existing[0] && existing[0].id !== user.id) {
    response.status(409).json({ error: "That username is already in use." });
    return;
  }
  const [updated] = await db
    .update(users)
    .set({
      username,
      email: `${username}@${DOMAIN}`,
      emailChangesRemaining: changing ? changesRemaining - 1 : changesRemaining,
      emailChangeYear: currentYear,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();
  response.json(publicUser(updated));
});

router.get("/mailbox/summary", async (request: AuthenticatedRequest, response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const [messageCounts, folderCount, notificationCount] = await Promise.all([
    db
      .select({ folder: messages.folder, total: count(), unread: count(messages.isRead) })
      .from(messages)
      .where(eq(messages.userId, user.id))
      .groupBy(messages.folder),
    db.select({ total: count() }).from(folders).where(eq(folders.userId, user.id)),
    db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false))),
  ]);
  const byFolder = Object.fromEntries(messageCounts.map((row) => [row.folder, Number(row.total)]));
  const unread = await db
    .select({ total: count() })
    .from(messages)
    .where(and(eq(messages.userId, user.id), eq(messages.isRead, false)));
  response.json({
    unread: Number(unread[0]?.total ?? 0),
    inbox: byFolder.inbox ?? 0,
    sent: byFolder.sent ?? 0,
    spam: byFolder.spam ?? 0,
    drafts: byFolder.drafts ?? 0,
    folders: Number(folderCount[0]?.total ?? 0),
    notifications: Number(notificationCount[0]?.total ?? 0),
  });
});

router.get("/messages", async (request: AuthenticatedRequest, response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const folder = typeof request.query.folder === "string" ? request.query.folder : "inbox";
  const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
  const folderFilter =
    folder === "starred"
      ? eq(messages.isStarred, true)
      : eq(messages.folder, folder);
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.userId, user.id), folderFilter))
    .orderBy(desc(messages.receivedAt));
  const output = rows.map(publicMessage).filter((message) =>
    query
      ? [message.from, message.to, message.subject, message.body].some((value) =>
          value.toLowerCase().includes(query.toLowerCase()),
        )
      : true,
  );
  response.json(output);
});

router.get("/messages/:id", async (request: AuthenticatedRequest, response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const messageId = String(request.params.id);
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.userId, user.id)))
    .limit(1);
  if (!rows[0]) {
    response.status(404).json({ error: "Message not found" });
    return;
  }
  await db.update(messages).set({ isRead: true }).where(eq(messages.id, rows[0].id));
  response.json(publicMessage({ ...rows[0], isRead: true }));
});

router.patch("/messages/:id", async (request: AuthenticatedRequest, response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const messageId = String(request.params.id);
  const parsed = UpdateMessageBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid message update." });
    return;
  }
  const [updated] = await db
    .update(messages)
    .set(parsed.data)
    .where(and(eq(messages.id, messageId), eq(messages.userId, user.id)))
    .returning();
  if (!updated) {
    response.status(404).json({ error: "Message not found" });
    return;
  }
  response.json(publicMessage(updated));
});

router.post("/messages", async (request: AuthenticatedRequest, response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const parsed = SendMessageBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Recipient, subject, and message are required." });
    return;
  }
  const { to, subject, body } = parsed.data;
  const from = user.email;
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    response.status(503).json({ error: "Outbound email is not configured yet. Add RESEND_API_KEY to the server environment." });
    return;
  }
  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `FPEDS <${from}>`,
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!resendResponse.ok) {
      response.status(502).json({ error: "The mail provider rejected this message." });
      return;
    }
  } catch {
    response.status(502).json({ error: "The mail provider could not be reached. Your message was not sent." });
    return;
  }
  const [created] = await db
    .insert(messages)
    .values({
      id: newId(),
      userId: user.id,
      folder: "sent",
      encryptedFrom: encryptValue(from),
      encryptedTo: encryptValue(to),
      encryptedSubject: encryptValue(subject),
      encryptedBody: encryptValue(body),
      isRead: true,
    })
    .returning();
  response.status(201).json(publicMessage(created));
});

router.get("/folders", async (request: AuthenticatedRequest, response: Response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const rows = await db
    .select({ id: folders.id, name: folders.name, count: count(messages.id) })
    .from(folders)
    .leftJoin(messages, and(eq(messages.folder, folders.name), eq(messages.userId, user.id)))
    .where(eq(folders.userId, user.id))
    .groupBy(folders.id)
    .orderBy(asc(folders.createdAt));
  response.json(rows.map((row) => ({ ...row, count: Number(row.count) })));
});

router.post("/folders", async (request: AuthenticatedRequest, response: Response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const parsed = CreateFolderBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Folder name is required." });
    return;
  }
  const name = parsed.data.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const [created] = await db
    .insert(folders)
    .values({ id: newId(), userId: user.id, name })
    .returning();
  response.status(201).json({ id: created.id, name: created.name, count: 0 });
});

router.get("/subscriptions", async (request: AuthenticatedRequest, response: Response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .orderBy(desc(subscriptions.createdAt));
  response.json(
    rows.map((row) => ({
      id: row.id,
      email: decryptValue(row.encryptedEmail),
      label: decryptValue(row.encryptedLabel),
      active: row.active,
    })),
  );
});

router.post("/subscriptions", async (request: AuthenticatedRequest, response: Response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const parsed = CreateSubscriptionBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Email and label are required." });
    return;
  }
  const [created] = await db
    .insert(subscriptions)
    .values({
      id: newId(),
      userId: user.id,
      encryptedEmail: encryptValue(parsed.data.email.trim()),
      encryptedLabel: encryptValue(parsed.data.label.trim()),
    })
    .returning();
  response.status(201).json({
    id: created.id,
    email: parsed.data.email.trim(),
    label: parsed.data.label.trim(),
    active: true,
  });
});

router.get("/notifications", async (request: AuthenticatedRequest, response: Response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(30);
  response.json(
    rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: decryptValue(row.encryptedTitle),
      message: decryptValue(row.encryptedMessage),
      createdAt: row.createdAt,
      isRead: row.isRead,
    })),
  );
});

router.post("/notifications/:id/read", async (request: AuthenticatedRequest, response: Response) => {
  const user = await requireUser(request, response);
  if (!user) return;
  const notificationId = String(request.params.id);
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)));
  response.status(204).send();
});

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

router.post("/webhooks/resend", async (request, response) => {
  const event = request.body as {
    type?: string;
    data?: {
      email_id?: string;
      from?: string;
      to?: string[];
      received_for?: string[];
      subject?: string;
    };
    to?: string;
    from?: string;
    subject?: string;
    text?: string;
  };
  if (event?.type && event.type !== "email.received") {
    response.status(200).json({ received: true });
    return;
  }

  let to = event?.to ?? event?.data?.received_for?.[0] ?? event?.data?.to?.[0] ?? "";
  let from = event?.from ?? event?.data?.from ?? "";
  let subject = event?.subject ?? event?.data?.subject ?? "";
  let body = event?.text ?? "";

  if (event?.type === "email.received") {
    const resendKey = process.env.RESEND_API_KEY;
    const emailId = event.data?.email_id;
    if (!resendKey || !emailId) {
      response.status(503).json({ error: "Inbound email retrieval is not configured." });
      return;
    }
    try {
      const receivedResponse = await fetch(
        `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
        { headers: { Authorization: `Bearer ${resendKey}` } },
      );
      if (!receivedResponse.ok) {
        response.status(502).json({ error: "The received email could not be retrieved from Resend." });
        return;
      }
      const received = (await receivedResponse.json()) as {
        from?: string;
        to?: string[];
        received_for?: string[];
        subject?: string;
        text?: string | null;
        html?: string | null;
      };
      to = received.received_for?.[0] ?? received.to?.[0] ?? to;
      from = received.from ?? from;
      subject = received.subject ?? subject;
      body = received.text?.trim() || (received.html ? htmlToText(received.html) : "");
    } catch {
      response.status(502).json({ error: "The received email could not be retrieved from Resend." });
      return;
    }
  }

  const username = to.split("@")[0]?.toLowerCase();
  if (!username || !from || !subject || !body) {
    response.status(400).json({ error: "Invalid inbound message." });
    return;
  }
  const owner = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!owner[0]) {
    response.status(202).send();
    return;
  }
  const spamScore = await classifySpam(subject, body);
  const blocked = spamScore >= 0.75;
  await db.insert(messages).values({
    id: newId(),
    userId: owner[0].id,
    folder: blocked ? "spam" : "inbox",
    encryptedFrom: encryptValue(from),
    encryptedTo: encryptValue(to),
    encryptedSubject: encryptValue(subject),
    encryptedBody: encryptValue(body),
    spamScore,
    blocked,
  });
  if (blocked) {
    await notify(
      owner[0].id,
      "Spam email blocked",
      `A message from ${from} was moved to Spam by FPEDS protection.`,
      "spam",
    );
  }
  response.status(202).send();
});

export default router;