/**
 * Vite dev-server plugin: fetches YouTube transcripts from the local machine.
 *
 * YouTube blocks transcript requests from cloud IPs (Render, etc.), so the
 * transcript is fetched here -- inside `npm run dev`, on your home IP -- and
 * the hosted backend is only used for the AI chat.
 *
 * Endpoint: GET /local-api/analyze?url=<youtube url or id>
 */
import type { Plugin } from "vite";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

interface Segment {
  start: number;
  duration: number;
  text: string;
}

export function extractVideoId(input: string): string | null {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.replace(/^(www|m|music)\./, "");
    if (host === "youtu.be") return url.pathname.slice(1, 12) || null;
    const v = url.searchParams.get("v");
    if (v) return v.slice(0, 11);
    const m = url.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchTranscript(videoId: string) {
  // 1) Grab the innertube API key from the watch page.
  const html = await (
    await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    })
  ).text();
  const apiKey = html.match(/"INNERTUBE_API_KEY":\s*"([^"]+)"/)?.[1];
  if (!apiKey) throw new Error("Could not read YouTube page.");

  // 2) Ask the player API (Android client) for caption tracks.
  const player = await (
    await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({
        context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
        videoId,
      }),
    })
  ).json();

  const status = player?.playabilityStatus?.status;
  if (status && status !== "OK") {
    const err = new Error(player.playabilityStatus.reason || "Video unavailable.");
    (err as any).code = 404;
    throw err;
  }

  const tracks: any[] =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!tracks.length) throw new Error("No captions for this video.");

  const track =
    tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode?.startsWith("en")) ??
    tracks[0];

  // 3) Download and parse the caption XML.
  const xml = await (
    await fetch(String(track.baseUrl).replace("&fmt=srv3", ""), {
      headers: { "User-Agent": UA },
    })
  ).text();

  const transcript: Segment[] = [];
  const re = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  for (const m of xml.matchAll(re)) {
    const text = decodeEntities(m[3]);
    if (text) transcript.push({ start: +m[1], duration: +(m[2] ?? 0), text });
  }
  if (!transcript.length) throw new Error("Transcript was empty.");

  const title = html.match(/<title>(.*?)(?: - YouTube)?<\/title>/)?.[1];

  return {
    videoId,
    title: title ? decodeEntities(title) : null,
    transcript,
    transcriptAvailable: true,
    transcriptLanguage: track.languageCode ?? null,
  };
}

export function localTranscriptPlugin(): Plugin {
  const cache = new Map<string, unknown>();
  return {
    name: "local-transcript",
    configureServer(server) {
      server.middlewares.use("/local-api/analyze", async (req, res) => {
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        const url = new URL(req.url ?? "", "http://x").searchParams.get("url") ?? "";
        const id = extractVideoId(url);
        if (!id) return send(400, { detail: "That doesn't look like a valid YouTube URL." });
        try {
          if (!cache.has(id)) cache.set(id, await fetchTranscript(id));
          send(200, cache.get(id));
        } catch (e: any) {
          server.config.logger.warn(`[transcript] ${id}: ${e.message}`);
          send(e.code === 404 ? 404 : 422, {
            detail:
              e.code === 404
                ? "This video is unavailable. It may be private, deleted, or region-restricted."
                : "We couldn't access a transcript for this video.",
          });
        }
      });
    },
  };
}
