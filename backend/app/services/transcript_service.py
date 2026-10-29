"""
Transcript extraction service.

Uses youtube-transcript.ai as the transcript source because direct
YouTube transcript requests can be blocked when the backend runs
from a cloud provider such as Render.

The rest of the application remains independent of the transcript
provider.
"""

from collections import OrderedDict
from dataclasses import dataclass
from typing import List, Optional
import re

import httpx

from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.schemas.video import TranscriptSegment

logger = get_logger(__name__)


class TranscriptUnavailableError(Exception):
    """Raised when no transcript could be retrieved for a video."""


class VideoUnavailableError(Exception):
    """Raised when the video itself cannot be found or is private/deleted."""


@dataclass
class TranscriptResult:
    segments: List[TranscriptSegment]
    language: Optional[str]


class _InMemoryTranscriptCache:
    """Small process-local LRU cache keyed by video id."""

    def __init__(self, max_items: int = 100) -> None:
        self._store: "OrderedDict[str, TranscriptResult]" = OrderedDict()
        self._max_items = max_items

    def get(self, video_id: str) -> Optional[TranscriptResult]:
        result = self._store.get(video_id)
        if result is not None:
            self._store.move_to_end(video_id)
        return result

    def set(self, video_id: str, result: TranscriptResult) -> None:
        self._store[video_id] = result
        self._store.move_to_end(video_id)
        while len(self._store) > self._max_items:
            self._store.popitem(last=False)


class TranscriptService:
    def __init__(self) -> None:
        self._cache = _InMemoryTranscriptCache()

    def get_transcript(self, video_id: str) -> TranscriptResult:
        cached = self._cache.get(video_id)

        if cached is not None:
            logger.info("transcript cache hit video_id=%s", video_id)
            return cached

        # 1) Try YouTube directly (works well when running locally).
        direct = self._fetch_direct(video_id)
        if direct is not None:
            self._cache.set(video_id, direct)
            return direct

        logger.info(
            "transcript fetch started video_id=%s provider=youtube-transcript.ai",
            video_id,
        )

        url = f"https://youtube-transcript.ai/transcript/{video_id}.txt"
        api_key = get_settings().transcript_api_key.strip()
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

        try:
            response = httpx.get(
                url,
                headers=headers,
                timeout=20.0,
                follow_redirects=True,
            )

            logger.info(
                "transcript provider response video_id=%s status=%s",
                video_id,
                response.status_code,
            )

            if response.status_code == 404:
                raise VideoUnavailableError(
                    "The video could not be found or is unavailable."
                )

            response.raise_for_status()

            text = response.text.strip()

            if not text:
                raise TranscriptUnavailableError(
                    "The transcript returned by the provider was empty."
                )

            segments = self._parse_transcript(text)

            if not segments:
                raise TranscriptUnavailableError(
                    "Could not parse the transcript returned by the provider."
                )

            lang_match = re.search(r"^Language:\s*([a-zA-Z-]+)", text, re.MULTILINE)
            result = TranscriptResult(
                segments=segments,
                language=lang_match.group(1) if lang_match else None,
            )

            self._cache.set(video_id, result)

            logger.info(
                "transcript fetch succeeded video_id=%s segments=%d",
                video_id,
                len(segments),
            )

            return result

        except (VideoUnavailableError, TranscriptUnavailableError):
            raise

        except httpx.HTTPStatusError as exc:
            logger.warning(
                "transcript provider HTTP error video_id=%s status=%s",
                video_id,
                exc.response.status_code,
            )
            raise TranscriptUnavailableError(
                "We couldn't access a transcript for this video."
            ) from exc

        except httpx.RequestError as exc:
            logger.warning(
                "transcript provider request failed video_id=%s error=%s",
                video_id,
                type(exc).__name__,
            )
            raise TranscriptUnavailableError(
                "We couldn't access a transcript for this video."
            ) from exc

        except Exception as exc:
            logger.warning(
                "transcript fetch failed video_id=%s error=%s",
                video_id,
                type(exc).__name__,
            )
            raise TranscriptUnavailableError(
                "We couldn't access a transcript for this video."
            ) from exc

    @staticmethod
    def _fetch_direct(video_id: str) -> Optional[TranscriptResult]:
        """Fetch transcript straight from YouTube via youtube-transcript-api."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
        except ImportError:
            return None

        try:
            api = YouTubeTranscriptApi()
            transcript_list = api.list(video_id)
            try:
                transcript = transcript_list.find_transcript(["en", "en-US", "en-GB"])
            except Exception:
                # Fall back to whatever language is available.
                transcript = next(iter(transcript_list))

            fetched = transcript.fetch()
            segments = [
                TranscriptSegment(
                    start=float(s.start),
                    duration=float(s.duration),
                    text=" ".join(s.text.split()),
                )
                for s in fetched
                if s.text and s.text.strip()
            ]
            if not segments:
                return None

            logger.info(
                "transcript direct fetch succeeded video_id=%s segments=%d lang=%s",
                video_id,
                len(segments),
                transcript.language_code,
            )
            return TranscriptResult(segments=segments, language=transcript.language_code)
        except Exception as exc:
            logger.warning(
                "transcript direct fetch failed video_id=%s error=%s",
                video_id,
                type(exc).__name__,
            )
            return None

    @staticmethod
    def _parse_timestamp_seconds(hours: Optional[str], minutes: str, seconds: str) -> float:
        total = int(minutes) * 60 + float(seconds)
        if hours is not None:
            total += int(hours) * 3600
        return total

    @classmethod
    def _parse_transcript(cls, text: str) -> List[TranscriptSegment]:
        """
        Parse youtube-transcript.ai timestamped transcript text.

        Example:
            [0:02] Hello everyone
            [1:02:15] Welcome to the video
        """

        pattern = re.compile(
            r"\[(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)\]\s*(.*?)(?=\n\[(?:\d+:)?\d+:\d+(?:\.\d+)?\]|\n---|\n#|\Z)",
            re.DOTALL,
        )

        matches = list(pattern.finditer(text))

        segments: List[TranscriptSegment] = []

        for index, match in enumerate(matches):
            start = cls._parse_timestamp_seconds(
                match.group(1), match.group(2), match.group(3)
            )

            transcript_text = " ".join(
                match.group(4).split()
            ).strip()

            if not transcript_text:
                continue

            # Calculate duration from the next timestamp.
            if index + 1 < len(matches):
                next_match = matches[index + 1]
                next_start = cls._parse_timestamp_seconds(
                    next_match.group(1), next_match.group(2), next_match.group(3)
                )
                duration = max(0.1, next_start - start)
            else:
                # Last segment: give it a small fallback duration.
                duration = 2.0

            segments.append(
                TranscriptSegment(
                    start=start,
                    duration=duration,
                    text=transcript_text,
                )
            )

        return segments

    @staticmethod
    def fetch_video_title(video_id: str) -> Optional[str]:
        """
        Best-effort title lookup via YouTube's public oEmbed endpoint.
        No API key required.
        """

        try:
            resp = httpx.get(
                "https://www.youtube.com/oembed",
                params={
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "format": "json",
                },
                timeout=5.0,
            )

            if resp.status_code == 200:
                return resp.json().get("title")

        except Exception:
            logger.info(
                "title lookup failed video_id=%s",
                video_id,
            )

        return None


transcript_service = TranscriptService()