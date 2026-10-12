import React, { useState, useMemo } from "react";
import { useCms } from "../../context/CmsContext";
import { useMediaMap } from "../../hooks/useMediaMap";
import { resolveMediaUrl } from "../../utils/media";
import {
  Headphones,
  Calendar,
  User,
  BookOpen,
  Play,
  ExternalLink,
  Volume2,
  Video,
  Search,
  Music2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Helper to construct official Spotify embed URL from standard web or app link
function getSpotifyEmbedUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (url.includes("/embed/")) return url;
  const match = url.match(/open\.spotify\.com\/(episode|show|track)\/([a-zA-Z0-9]+)/);
  if (match) {
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
  }
  return null;
}

export const PublicSermonsPage: React.FC = () => {
  const { sermons, settings } = useCms();
  const mediaById = useMediaMap();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<string>("alle");
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [activeAudioTitle, setActiveAudioTitle] = useState<string>("");
  const [openSpotifyId, setOpenSpotifyId] = useState<string | null>(null);

  const seriesList = useMemo(() => {
    const set = new Set<string>();
    sermons.forEach((s) => {
      if (s.series) set.add(s.series);
    });
    return Array.from(set);
  }, [sermons]);

  const filteredSermons = useMemo(() => {
    return sermons.filter((s) => {
      if (selectedSeries !== "alle" && s.series !== selectedSeries) return false;
      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase();
        const matchTitle = s.title.toLowerCase().includes(q);
        const matchSpeaker = s.speaker.toLowerCase().includes(q);
        const matchBible = s.bibleText?.toLowerCase().includes(q);
        return matchTitle || matchSpeaker || matchBible;
      }
      return true;
    });
  }, [sermons, selectedSeries, searchTerm]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("no-NO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-semibold">
            <Headphones className="w-3.5 h-3.5 text-accent-700" />
            <span>Taler & Forkynnelse</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight">
            Taler fra {settings.churchName}
          </h1>
          <p className="text-sm text-stone-600 max-w-2xl leading-relaxed">
            Hør søndagens tale på nytt eller lytt til hele serier. Tilgjengelig med direkte avspilling og integrert Spotify-spiller.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {settings.podcastUrl && (
            <a
              href={settings.podcastUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 shadow-xs transition-colors"
            >
              <Music2 className="w-4 h-4" />
              <span>Åpne i Spotify</span>
              <ExternalLink className="w-3 h-3 text-emerald-200" />
            </a>
          )}
        </div>
      </div>

      {/* Floating Audio Player if currently listening to custom audio */}
      {activeAudioUrl && (
        <div className="sticky top-20 z-30 p-4 rounded-2xl bg-slate-900 text-white shadow-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-accent-300 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 animate-pulse" />
              Spiller nå: {activeAudioTitle}
            </span>
            <button
              type="button"
              onClick={() => setActiveAudioUrl(null)}
              className="text-stone-400 hover:text-white font-bold"
            >
              Lukk
            </button>
          </div>
          <audio controls autoPlay src={activeAudioUrl} className="w-full h-10 rounded-lg" />
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Series filters */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSelectedSeries("alle")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedSeries === "alle"
                ? "bg-slate-900 text-white"
                : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
            }`}
          >
            Alle serier ({sermons.length})
          </button>
          {seriesList.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedSeries(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedSeries === s
                  ? "bg-accent-500 text-slate-950"
                  : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Søk i taler, taler eller bibel..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs text-stone-800 placeholder-stone-400 focus:outline-hidden focus:border-stone-400"
          />
        </div>
      </div>

      {/* Sermons List */}
      <div className="space-y-5">
        {filteredSermons.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
            Ingen taler funnet med dette søket.
          </div>
        ) : (
          filteredSermons.map((sermon) => {
            const spotifyEmbed = getSpotifyEmbedUrl(sermon.spotifyUrl);
            const isSpotifyOpen = openSpotifyId === sermon.id;
            const image = resolveMediaUrl(sermon.imageUrl, mediaById, "web");

            return (
              <div
                key={sermon.id}
                className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs hover:border-accent-300 hover:shadow-md transition-all space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  {/* The picture says nothing the title beside it does not, so it is not read out */}
                  {image && (
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      className="w-full md:w-56 aspect-video object-cover rounded-xl shrink-0 bg-stone-100"
                    />
                  )}
                  <div className="space-y-2 max-w-2xl flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {sermon.series && (
                        <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] bg-accent-50 text-accent-900 border border-accent-200/60">
                          {sermon.series}
                        </span>
                      )}
                      <span className="text-stone-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(sermon.date)}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-stone-900">{sermon.title}</h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-stone-400" />
                        <span className="font-semibold text-stone-800">{sermon.speaker}</span>
                      </div>
                      {sermon.bibleText && (
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                          <span>{sermon.bibleText}</span>
                        </div>
                      )}
                    </div>

                    {sermon.summary && (
                      <p className="text-xs text-stone-500 leading-relaxed pt-1">
                        {sermon.summary}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons: Audio / Spotify / Video */}
                  <div className="shrink-0 flex flex-wrap sm:flex-nowrap md:flex-col items-start md:items-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100">
                    {/* Spotify Embed Toggle */}
                    {sermon.spotifyUrl && (
                      <button
                        type="button"
                        // Counted as a played sermon when the player is opened, not when it is closed again
                        data-besok-tale={isSpotifyOpen ? undefined : sermon.id}
                        onClick={() => setOpenSpotifyId(isSpotifyOpen ? null : sermon.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer ${
                          isSpotifyOpen
                            ? "bg-emerald-800 text-white"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        <Music2 className="w-3.5 h-3.5" />
                        <span>{isSpotifyOpen ? "Skjul Spotify" : "Spill i Spotify"}</span>
                        {isSpotifyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Standard Audio Play button if audio file exists */}
                    {sermon.audioUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAudioUrl(sermon.audioUrl || null);
                          setActiveAudioTitle(`${sermon.title} - ${sermon.speaker}`);
                        }}
                        className="px-4 py-2 rounded-xl bg-accent-400 hover:bg-accent-300 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Hør tale (Lydfil)</span>
                      </button>
                    )}

                    {/* Video Link */}
                    {sermon.videoUrl && (
                      <a
                        href={sermon.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        data-besok-tale={sermon.id}
                        className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Video className="w-3.5 h-3.5 text-rose-600" />
                        <span>Se video</span>
                        <ExternalLink className="w-3 h-3 text-stone-400" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Inline Spotify Player Embed */}
                {isSpotifyOpen && spotifyEmbed && (
                  <div className="pt-3 border-t border-stone-100">
                    <iframe
                      src={spotifyEmbed}
                      width="100%"
                      height="152"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-xl shadow-xs"
                      title={`Spotify avspiller for ${sermon.title}`}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
