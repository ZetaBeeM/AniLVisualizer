import { useEffect } from "react";

// Fetch function that handles 429 Too Many Requests (Rate Limits) with automatic Retry-After parsing.
const fetchWithRetry = async (url, options, retries = 3, delay = 1000, onRetry = null) => {
  try {
    const response = await fetch(url, options);
    if (response.status === 429) {
      if (retries > 0) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const waitTimeSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : Math.ceil(delay / 1000) * 2;
        const waitTimeMs = waitTimeSeconds * 1000;

        if (onRetry) {
          onRetry(waitTimeSeconds);
        }
        console.warn(`Rate limited. Retrying after ${waitTimeMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        return fetchWithRetry(url, options, retries - 1, delay * 2, onRetry);
      }
    }
    return response.ok ? response.json() : response.json().then(e => Promise.reject(e));
  } catch (error) {
    if (retries > 0) {
      console.warn(`Fetch error. Retrying after ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2, onRetry);
    }
    throw error;
  }
};

// The actual function that sends the query with the user's data.
function AniListObtainer({userName, refreshKey, onData, onLoading, onError}){
  useEffect(() => {
    if (!userName) return;

    if (onLoading) onLoading("Fetching completed anime list...");
    if (onError) onError(null);

    const url = 'https://graphql.anilist.co';

    // First fetches the list without relations since it's a lighter request.
    const listQuery = `
      query($userName: String, $type: MediaType, $status: MediaListStatus) {
        MediaListCollection(userName: $userName, type: $type, status: $status) {
          lists {
            status
            entries {
              startedAt {
                year
                month
                day
              }
              completedAt {
                year
                month
                day
              }
              repeat
              media {
                id
                format
                title {
                  english
                  romaji
                }
              }
            }
          }
        }
      }
    `;

    const listOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // We make sure to only grab completed anime.
      body: JSON.stringify({
        query: listQuery,
        variables: { userName, type: "ANIME", status: "COMPLETED" }
      })
    };

    fetchWithRetry(url, listOptions, 3, 1000, (seconds) => {
      if (onLoading) {
        onLoading(`Rate limit hit on list collection. Pausing for ${seconds}s...`);
      }
    })
      .then(listData => {
        const mediaLists = listData.data.MediaListCollection.lists;
        const initialAnime = mediaLists.flatMap(list => list.entries.map(entry => {
          return {
            ...entry.media,
            startedAt: entry.startedAt,
            completedAt: entry.completedAt,
            repeat: entry.repeat,
            relations: { edges: [] }
          };
        }));

        if (initialAnime.length === 0) {
          if (onLoading) onLoading(false);
          onData([]);
          return;
        }

        // Then relations get fetched in batches. AniList silently caps Page.perPage at 50
        // in a way where requesting more (e.g. 100) just truncates the results with no warning.
        const batchSize = 50;
        const animeIds = initialAnime.map(a => a.id);
        const batches = [];
        for (let i = 0; i < animeIds.length; i += batchSize) {
          batches.push(animeIds.slice(i, i + batchSize));
        }

        const relationQuery = `
          query($ids: [Int]) {
            Page(page: 1, perPage: 50) {
              media(id_in: $ids) {
                id
                relations {
                  edges {
                    relationType
                    node {
                      id
                      title {
                        english
                        romaji
                      }
                    }
                    id
                  }
                }
              }
            }
          }
        `;

        let completedBatches = 0;
        const relationsMap = {};

        // Helper to fetch a single batch
        const fetchBatch = (ids) => {
          const batchOptions = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              query: relationQuery,
              variables: { ids }
            })
          };

          return fetchWithRetry(url, batchOptions, 3, 1000, (seconds) => {
            if (onLoading) {
              onLoading(`Rate limit hit. Pausing for ${seconds} seconds to avoid block...`);
            }
          })
            .then(resData => {
              const mediaList = resData.data.Page.media;
              mediaList.forEach(m => {
                relationsMap[m.id] = m.relations;
              });
              completedBatches++;
              if (onLoading) {
                onLoading(`Fetching relations: ${Math.min(completedBatches * batchSize, animeIds.length)}/${animeIds.length} shows...`);
              }
            });
        };

        // Run batches sequentially (with a safe delay) to respect AniList rate limits
        const fetchAllBatches = async () => {
          try {
            for (const batch of batches) {
              await fetchBatch(batch);
              // Delay between batches to respect burst limits (350ms)
              await new Promise(r => setTimeout(r, 350));
            }

            // Initial list entries are combined with fetched relations
            const finalAnime = initialAnime.map(anime => {
              return {
                ...anime,
                relations: relationsMap[anime.id] || { edges: [] }
              };
            });

            localStorage.setItem("userData", JSON.stringify(finalAnime));
            localStorage.setItem("lastUser", userName);
            console.log("New batched request successful. Saved relevant data in localstorage.");

            if (onLoading) onLoading(false);
            onData(finalAnime);
          } catch (err) {
            handleError(err);
          }
        };

        fetchAllBatches();
      })
      .catch(handleError);

    function handleError(error) {
      if (onLoading) onLoading(false);
      const errMsg = error?.errors?.[0]?.message || error?.message || "Could not fetch user data. Please check the spelling or try again.";
      if (onError) onError(errMsg);
      console.error(error);
    }
  }, [userName, refreshKey]);

  return null;
}

export default AniListObtainer;
