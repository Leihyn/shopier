import { NextRequest, NextResponse } from "next/server";

// Telegram bot webhook for share-to-bot DM flow.
//
// Setup (one-time, after deploying to a public URL):
//   1. Create a bot via @BotFather, capture TELEGRAM_BOT_TOKEN
//   2. Pick a random TELEGRAM_WEBHOOK_SECRET (any string)
//   3. Add both to .env.local
//   4. Register the webhook:
//      curl -F "url=https://YOUR_DOMAIN/api/bot/telegram" \
//           -F "secret_token=YOUR_SECRET" \
//           https://api.telegram.org/bot<TOKEN>/setWebhook
//
// Behavior: user sends a photo or a link to the bot → bot replies with
// a shoppable breakdown. Photos are decomposed via /api/agent/decompose,
// then matched via /api/agent/match. Links are fetched server-side.

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TgPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number };
  text?: string;
  photo?: TgPhotoSize[];
  caption?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

async function tgApi<T = unknown>(method: string, body: unknown): Promise<T> {
  if (!TG_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Telegram ${method}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function downloadTelegramPhoto(fileId: string): Promise<string> {
  if (!TG_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing");
  // 1. Resolve file path
  const meta = await tgApi<{ ok: boolean; result: { file_path: string } }>(
    "getFile",
    { file_id: fileId }
  );
  // 2. Download bytes
  const fileUrl = `https://api.telegram.org/file/bot${TG_TOKEN}/${meta.result.file_path}`;
  const res = await fetch(fileUrl);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Shopier-Bot/0.1" },
  });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

function formatBreakdownMessage(
  breakdown: { items: Array<{ name: string; fitToYou?: string }>; styleNotes?: string },
  matches: Array<{
    originalItem: string;
    alternatives: Array<{ tier: string; price: number; url: string; retailer: string }>;
  }>
): string {
  const lines: string[] = [];
  lines.push(`*${breakdown.items.length} pieces identified*`);
  if (breakdown.styleNotes) {
    lines.push(`_${breakdown.styleNotes}_`);
  }
  lines.push("");

  for (const match of matches) {
    lines.push(`*${match.originalItem}*`);
    const item = breakdown.items.find((i) => i.name === match.originalItem);
    if (item?.fitToYou) {
      lines.push(`  ${item.fitToYou}`);
    }
    const tiered = ["budget", "mid", "exact"];
    for (const t of tiered) {
      const alt = match.alternatives.find((a) => a.tier === t && a.price > 0);
      if (alt) {
        const tierLabel = t === "exact" ? "premium" : t;
        lines.push(`  ${tierLabel}: $${alt.price.toFixed(0)} — [${alt.retailer}](${alt.url})`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  // Verify webhook secret
  if (TG_SECRET) {
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (headerSecret !== TG_SECRET) {
      return NextResponse.json({ error: "Bad secret" }, { status: 401 });
    }
  }

  if (!TG_TOKEN) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not configured" },
      { status: 500 }
    );
  }

  const update = (await req.json()) as TgUpdate;
  const msg = update.message;
  if (!msg) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id;

  try {
    let imageBase64: string | null = null;
    let triggerText = "";

    if (msg.photo && msg.photo.length > 0) {
      // Highest-resolution photo is last
      const largest = msg.photo[msg.photo.length - 1];
      imageBase64 = await downloadTelegramPhoto(largest.file_id);
      triggerText = msg.caption || "this outfit";
    } else if (msg.text) {
      const urlMatch = msg.text.match(/https?:\/\/\S+/);
      if (urlMatch) {
        try {
          imageBase64 = await fetchImageAsBase64(urlMatch[0]);
          triggerText = msg.text;
        } catch (e) {
          await tgApi("sendMessage", {
            chat_id: chatId,
            text:
              "Couldn't fetch that link as an image. Try sharing a direct image URL or a screenshot.",
          });
          return NextResponse.json({ ok: true });
        }
      } else {
        await tgApi("sendMessage", {
          chat_id: chatId,
          text:
            "Send me an outfit screenshot or paste a link to a post — I'll break it down and find shoppable matches. Connect your wallet at shopier.app to unlock twin-calibrated commentary and on-chain settlement.",
        });
        return NextResponse.json({ ok: true });
      }
    } else {
      return NextResponse.json({ ok: true });
    }

    if (!imageBase64) return NextResponse.json({ ok: true });

    await tgApi("sendChatAction", { chat_id: chatId, action: "typing" });

    // Decompose (no twin context — anonymous chat)
    const origin = req.nextUrl.origin;
    const dRes = await fetch(`${origin}/api/agent/decompose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
    });
    if (!dRes.ok) {
      const err = await dRes.json().catch(() => ({}));
      await tgApi("sendMessage", {
        chat_id: chatId,
        text: `Sorry, vision step failed: ${err.error || "unknown"}`,
      });
      return NextResponse.json({ ok: true });
    }
    const { breakdown } = await dRes.json();

    // Match
    const mRes = await fetch(`${origin}/api/agent/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: breakdown.items }),
    });
    if (!mRes.ok) {
      await tgApi("sendMessage", {
        chat_id: chatId,
        text: "Matched nothing — try a clearer screenshot.",
      });
      return NextResponse.json({ ok: true });
    }
    const { matches } = await mRes.json();

    const replyText = formatBreakdownMessage(breakdown, matches);
    await tgApi("sendMessage", {
      chat_id: chatId,
      text: replyText,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("bot error", err);
    try {
      await tgApi("sendMessage", {
        chat_id: chatId,
        text: `Error: ${(err as Error).message}`,
      });
    } catch {}
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({
    bot: "Shopier",
    description:
      "Telegram webhook. POST Telegram updates here. See route.ts for setup.",
  });
}
