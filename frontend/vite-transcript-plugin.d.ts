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
interface Segment {
    start: number;
    duration: number;
    text: string;
}
export declare function extractVideoId(input: string): string | null;
export declare function fetchTranscript(videoId: string): Promise<{
    videoId: string;
    title: string;
    transcript: Segment[];
    transcriptAvailable: boolean;
    transcriptLanguage: any;
}>;
export declare function localTranscriptPlugin(): Plugin;
export {};
