import { useState, useEffect } from "react";

// Fetches an entry's description/poster when its node is clicked.
function AnimeDetailsPanel({ animeId, onClose }) {
  const [details, setDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!animeId) {
      setDetails(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setDetails(null);

    const query = `
      query($id: Int) {
        Media(id: $id) {
          id
          title {
            english
            romaji
          }
          description(asHtml: true)
          coverImage {
            large
            extraLarge
          }
          format
          episodes
          averageScore
          genres
          siteUrl
        }
      }
    `;

    fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables: { id: Number(animeId) } }),
    })
      .then((res) => (res.ok ? res.json() : res.json().then((e) => Promise.reject(e))))
      .then((data) => {
        if (cancelled) return;
        setDetails(data.data.Media);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.errors?.[0]?.message || "Could not load anime details.";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [animeId]);

  if (!animeId) return null;

  return (
    <div className="absolute right-6 top-6 bg-neutral-900 border border-neutral-700 rounded-xl z-40 text-neutral-200 w-72 max-h-[calc(100vh-3rem)] overflow-y-auto flex flex-col gap-3">
      <div className="sticky top-0 bg-neutral-900 flex items-start justify-between gap-2 p-4 pb-2 rounded-t-xl">
        <h2 className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
          Details
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer shrink-0"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
      {isLoading && (
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="w-full aspect-[2/3] rounded-lg bg-neutral-800" />
          <div className="h-4 w-3/4 rounded bg-neutral-800" />
          <div className="flex flex-wrap gap-1.5">
            <div className="h-4 w-10 rounded bg-neutral-800" />
            <div className="h-4 w-14 rounded bg-neutral-800" />
            <div className="h-4 w-10 rounded bg-neutral-800" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-full rounded bg-neutral-800" />
            <div className="h-3 w-full rounded bg-neutral-800" />
            <div className="h-3 w-5/6 rounded bg-neutral-800" />
            <div className="h-3 w-2/3 rounded bg-neutral-800" />
          </div>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-xs rounded-lg p-3 font-fira leading-relaxed">
         {error}
        </div>
      )}

      {details && !isLoading && !error && (
        <>
          {details.coverImage?.large && (
            <img
              src={details.coverImage.large}
              alt={details.title.english || details.title.romaji}
              className="rounded-lg w-full object-cover"
            />
          )}
          <h3 className="text-sm font-semibold text-neutral-100 leading-snug">
            {details.title.english || details.title.romaji}
          </h3>
          <div className="flex flex-wrap gap-1.5 text-[10px] text-neutral-400">
            {details.format && (
              <span className="px-1.5 py-0.5 rounded bg-neutral-800 uppercase font-semibold">
                {details.format}
              </span>
            )}
            {details.episodes && (
              <span className="px-1.5 py-0.5 rounded bg-neutral-800">
                {details.episodes} eps
              </span>
            )}
            {details.averageScore != null && (
              <span className="px-1.5 py-0.5 rounded bg-neutral-800">
                % {details.averageScore}
              </span>
            )}
          </div>
          {details.description && (
            <p
              className="text-xs text-neutral-300 leading-relaxed [&_a]:text-neutral-100 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: details.description }}
            />
          )}
          {details.siteUrl && (
            <a
              href={details.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-neutral-200 underline hover:text-neutral-50 mt-1"
            >
              View on AniList
            </a>
          )}
        </>
      )}
      </div>
    </div>
  );
}

export default AnimeDetailsPanel;
