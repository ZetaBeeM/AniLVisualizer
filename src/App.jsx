import { useState, useEffect, useRef } from 'react'
import AniListObtainer from './components/anilistListObtainer'
import Graphrender from './components/aniGraphConstructor';
import AnimeDetailsPanel from './components/animeDetailsPanel';
import './styles/visualizer.css'

function App() {
    // Brief rundown of what the non-trivial hooks do here.
    const [aniUser, setAniUser] = useState("") // The profile's username. Necessary to querry the API and obtain their data.
    const [inputValue, setInputValue] = useState("") // The value in the username text box. Changes with every input.
    const [animeData, setAnimeData] = useState([]) // The list data. Used to generate the graph.
    const [aniUserDisplay, setAniUserDisplay] = useState("") // Also the username. Makes it so it renders it in the necessary components.
    const [aniLastUser, setAniLastUser] = useState("") // Last username inputted into the page so it knows when to reuse data instead of grabbing it again.
    const [savedData, setSavedData] = useState([]); // Saves the data to localStorage in order to be reused if a user is checking the same profile again.
    const [searchQuery, setSearchQuery] = useState(""); // Value in the entry search box. Lets users search nodes by name.
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hoveredAnimeInfo, setHoveredAnimeInfo] = useState(null); // The information of an entry a user clicks on. Used by the details card.
    const [refreshKey, setRefreshKey] = useState(0);
    const [hiddenFormats, setHiddenFormats] = useState(() => new Set()); // Which formats the user wants to filter out.
    const [hideStandalone, setHideStandalone] = useState(false); // Whether standalone nodes are shown or not.
    const [selectedAnimeId, setSelectedAnimeId] = useState(null); // The ID of the node a user clicks on.
    const sigmaRef = useRef(null);

    const toggleFormatFilter = (format) => {
        setHiddenFormats((prev) => {
            const next = new Set(prev);
            if (next.has(format)) next.delete(format);
            else next.add(format);
            return next;
        });
    };

    // Filters are monitored with a useEffect hook so they don't rebuild the graph or change the layout.
    // Checks for hiddenFormats (OVAs, movies, TV shows) and also hideStandalone (nodes that don't have any edges) to hide them as needed.
    useEffect(() => {
        sigmaRef.current?.setFilters(hiddenFormats, hideStandalone);
    }, [hiddenFormats, hideStandalone, animeData]);
    // Date formatting, lists entries as not specified if there's no start and/or end dates on the entry.
    const formatFuzzyDate = (date) => {
        if (!date || (!date.year && !date.month && !date.day)) return "Not specified";
        const parts = [];
        if (date.year) parts.push(date.year);
        if (date.month) parts.unshift(String(date.month).padStart(2, '0'));
        if (date.day) parts.unshift(String(date.day).padStart(2, '0'));

        if (date.year && date.month && date.day) {
            return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
        }
        return parts.join('/');
    };

    const formatMediaFormat = (format) => {
        const labels = {
            TV: "TV",
            TV_SHORT: "TV Short",
            MOVIE: "Movie",
            SPECIAL: "Special",
            OVA: "OVA",
            ONA: "ONA",
            MUSIC: "Music",
        };
        return labels[format] || format;
    };

    const searchItems = animeData.length > 0 ? [
        { id: aniUserDisplay, label: `${aniUserDisplay} (You)` },
        ...animeData.map((anime) => ({
            id: String(anime.id),
            label: anime.title.english || anime.title.romaji,
        })),
    ] : [];

    const filteredItems = searchQuery.trim() === ""
        ? []
        : searchItems.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5);

    const handleSelectNode = (nodeId) => {
        if (sigmaRef.current) {
            sigmaRef.current.focusNode(nodeId);
        }
        setSearchQuery("");
        setIsDropdownOpen(false);
    };
    // Handling of the username input. Selects the userData of lastUser (if these exist) and then checks
    // Whether the submitted username is the same as that one.
    // If it is, it just loads the already saved data and sets all the name values to userName (which will be the same as lastUser).
    // If not, it flushes the previous values before obtaining the new ones.
    useEffect (() =>{
        const data = localStorage.getItem("userData")
        const lastUser = localStorage.getItem("lastUser")
        if (data) setSavedData(JSON.parse(data));
        if (!lastUser) setAniLastUser("")
            else if (lastUser) setAniLastUser(lastUser)
    }, [])
    function handleSubmit(e){
        e.preventDefault();
        if (inputValue === "") {
            console.log("Username not entered.")
        }
        else if (inputValue === aniLastUser){
            setAnimeData(savedData)
            setAniLastUser(inputValue)
            setAniUserDisplay(inputValue)
            setError(null);
            setSelectedAnimeId(null);
            console.log("Same user as last time, reusing old data.")
        } else {
            setAnimeData([]);
            setError(null);
            setAniUser(inputValue)
            setAniUserDisplay(inputValue)
            setSelectedAnimeId(null);
            console.log("Not the same user as last time, fetching new data.")
        }
    }
    // Spins its wheels while loading is going on (and aniUserDisplay isn't set).
    function handleRefresh(){
        if (!aniUserDisplay || isLoading) return;
        setAnimeData([]);
        setError(null);
        setAniUser(aniUserDisplay);
        setRefreshKey((key) => key + 1);
        setSelectedAnimeId(null);
    }

return(
        <>
        <div className='font-fira graph-paper'>
            <div className='absolute left-6 top-6 bg-neutral-900 border border-neutral-700 rounded-xl pt-5 pb-5 pl-5 pr-7 z-40 text-neutral-200 w-80 max-h-[calc(100vh-3rem)] overflow-y-auto flex flex-col gap-3'>
                <h2 className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
                    AniList Graph Viewer
                </h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                    <label htmlFor="username-input" className="text-xs text-neutral-400">
                        Enter your AniList nickname
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="username-input"
                            type="text"
                            placeholder="e.g. ZetaBeeM"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            disabled={isLoading}
                            className="flex-1 min-w-0 bg-neutral-950 border border-neutral-700 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 rounded-lg px-3 py-1.5 text-sm text-neutral-200 outline-none transition-all placeholder:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-neutral-200 hover:bg-neutral-100 active:bg-neutral-300 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-900 rounded-lg px-4 py-1.5 text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 min-w-[70px]"
                        >
                            {isLoading ? (
                                <span className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-neutral-800 rounded-full animate-spin"></span>
                            ) : "Load"}
                        </button>
                    </div>
                </form>
                {error && (
                    <div className="bg-red-950 border border-red-800 text-red-300 text-xs rounded-lg p-3 font-fira leading-relaxed animate-[fadeIn_0.2s_ease-out]">
                        {error}
                    </div>
                )}
                {aniUserDisplay && !error && (
                    <div className="pt-2 border-t border-neutral-800 text-xs text-neutral-400 flex items-center justify-between gap-2">
                        <span>
                            Showing: <strong className="text-neutral-200">{aniUserDisplay}</strong>
                            {animeData.length > 0 && !isLoading && (
                                <>
                                    {" "}&middot; Completed:{" "}
                                    <strong className="text-neutral-200">{animeData.length}</strong>
                                </>
                            )}
                        </span>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isLoading}
                            title="Refetch latest data from AniList (bypasses cache)"
                            className="text-neutral-400 hover:text-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 text-sm leading-none"
                        >
                            ⟳
                        </button>
                    </div>
                )}
                {animeData.length > 0 && !isLoading && (
                    <div className="pt-3 border-t border-neutral-800 flex flex-col gap-2 relative">
                        <label htmlFor="search-node-input" className="text-xs text-neutral-400">
                            Search Anime / User
                        </label>
                        <div className="relative">
                            <input
                                id="search-node-input"
                                type="text"
                                placeholder="Type to search..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                className="w-full bg-neutral-950 border border-neutral-700 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 rounded-lg px-3 py-1.5 text-xs text-neutral-200 outline-none transition-all placeholder:text-neutral-600"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1.5 text-neutral-500 hover:text-neutral-300 text-xs px-1 cursor-pointer"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Autocomplete */}
                        {isDropdownOpen && filteredItems.length > 0 && (
                            <ul className="absolute top-[100%] left-0 w-full mt-1.5 bg-neutral-950 border border-neutral-800 rounded-lg max-h-48 overflow-y-auto z-50 py-1">
                                {filteredItems.map((item) => (
                                    <li
                                        key={item.id}
                                        onMouseDown={() => handleSelectNode(item.id)}
                                        className="px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 cursor-pointer truncate transition-colors"
                                    >
                                        {item.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
                {animeData.length > 0 && !isLoading && (
                    <div className="pt-3 border-t border-neutral-800 flex flex-col gap-2">
                        <span className="text-xs text-neutral-400">Filter</span>
                        <div className="flex flex-wrap gap-1.5">
                            {["TV", "MOVIE", "OVA", "ONA", "TV_SHORT", "SPECIAL", "MUSIC"].map((format) => {
                                const isHidden = hiddenFormats.has(format);
                                return (
                                    <button
                                        key={format}
                                        type="button"
                                        onClick={() => toggleFormatFilter(format)}
                                        className={`text-[10px] uppercase font-semibold px-2 py-1 rounded border transition-colors cursor-pointer ${
                                            isHidden
                                                ? "bg-neutral-800 border-neutral-700 text-neutral-500"
                                                : "bg-neutral-800 border-neutral-500 text-neutral-200 hover:border-neutral-300"
                                        }`}
                                    >
                                        {isHidden ? "Show" : "Hide"} {formatMediaFormat(format)}
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                onClick={() => setHideStandalone((prev) => !prev)}
                                className={`text-[10px] uppercase font-semibold px-2 py-1 rounded border transition-colors cursor-pointer ${
                                    hideStandalone
                                        ? "bg-neutral-800 border-neutral-700 text-neutral-500"
                                        : "bg-neutral-800 border-neutral-500 text-neutral-200 hover:border-neutral-300"
                                }`}
                            >
                                {hideStandalone ? "Show" : "Hide"} Standalone
                            </button>
                        </div>
                    </div>
                )}
                <AniListObtainer
                    userName={aniUser}
                    refreshKey={refreshKey}
                    onData={setAnimeData}
                    onLoading={setIsLoading}
                    onError={setError}
                />
                {hoveredAnimeInfo && (
                    <div className="pt-3 border-t border-neutral-800 flex flex-col gap-1.5 text-xs text-neutral-300 animate-[fadeIn_0.2s_ease-out]">
                        <h3 className="font-semibold text-neutral-500 uppercase text-[10px] tracking-wider">
                            Selection Details
                        </h3>
                        <p className="font-semibold text-neutral-100 text-xs leading-normal flex items-center gap-1.5 flex-wrap">
                            {hoveredAnimeInfo.title}
                            {hoveredAnimeInfo.format && (
                                <span className="text-[8px] text-neutral-300 bg-neutral-800 border border-neutral-600 px-1 py-0.5 rounded uppercase font-semibold shrink-0">
                                    {formatMediaFormat(hoveredAnimeInfo.format)}
                                </span>
                            )}
                        </p>
                        {!hoveredAnimeInfo.isUser && (
                            <div className="flex flex-col gap-1 mt-1 text-neutral-400">
                                <div className="flex justify-between gap-4">
                                    <span>Started:</span>
                                    <span className="text-neutral-300 font-medium">
                                        {formatFuzzyDate(hoveredAnimeInfo.startedAt)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span>Completed:</span>
                                    <span className="text-neutral-300 font-medium">
                                        {formatFuzzyDate(hoveredAnimeInfo.completedAt)}
                                    </span>
                                </div>
                                {hoveredAnimeInfo.repeat > 0 && (
                                    <div className="flex justify-between gap-4">
                                        <span>Rewatches:</span>
                                        <span className="text-neutral-300 font-medium">
                                            {hoveredAnimeInfo.repeat}
                                        </span>
                                    </div>
                                )}
                                {hoveredAnimeInfo.relations && hoveredAnimeInfo.relations.length > 0 && (
                                    <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-neutral-800">
                                        <span className="font-semibold text-neutral-500 uppercase text-[9px] tracking-wider">
                                            Connections ({hoveredAnimeInfo.relations.length})
                                        </span>
                                        <ul className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                                            {hoveredAnimeInfo.relations.map((rel, index) => (
                                                <li key={index} className="flex justify-between items-start gap-2 text-[11px] leading-tight">
                                                    <span className="text-neutral-300 font-medium truncate max-w-[180px]" title={rel.title}>
                                                        {rel.title}
                                                    </span>
                                                    <span className="text-[8px] text-neutral-300 bg-neutral-800 border border-neutral-600 px-1 py-0.5 rounded uppercase font-semibold shrink-0">
                                                        {rel.type}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        {isLoading && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-neutral-400">
                <div className="w-14 h-14 border-4 border-neutral-800 border-t-neutral-300 rounded-full animate-spin"></div>
                <div className="flex flex-col items-center gap-1 text-center">
                    <p className="text-sm font-semibold text-neutral-300">
                        {typeof isLoading === "string" ? isLoading : "Fetching completed anime list..."}
                    </p>
                    <p className="text-xs text-neutral-500">Constructing prequel, sequel, and spin-off relations graph</p>
                </div>
            </div>
        )}
        {animeData.length > 0 && !isLoading && (
        <Graphrender
            userName={aniUserDisplay}
            listData={animeData}
            sigmaRef={sigmaRef}
            onHoverNode={(nodeId) => {
                if (!nodeId) {
                    setHoveredAnimeInfo(null);
                    return;
                }
                const anime = animeData.find(a => String(a.id) === nodeId);
                if (anime) {
                    const hoveredId = String(anime.id);
                    const connectedIds = new Set();
                    const relations = [];

                    // First check relations of the hovered anime itself
                    anime.relations.edges.forEach(edge => {
                        const relatedId = String(edge.node.id);
                        if (relatedId !== hoveredId && animeData.some(a => String(a.id) === relatedId)) {
                            connectedIds.add(relatedId);
                            const relatedAnime = animeData.find(a => String(a.id) === relatedId);
                            relations.push({
                                title: relatedAnime.title.english || relatedAnime.title.romaji,
                                type: edge.relationType
                            });
                        }
                    });

                    // Afterwards check relations of other anime pointing to this one
                    animeData.forEach(otherAnime => {
                        const otherId = String(otherAnime.id);
                        if (otherId !== hoveredId && !connectedIds.has(otherId)) {
                            otherAnime.relations.edges.forEach(edge => {
                                if (String(edge.node.id) === hoveredId) {
                                    connectedIds.add(otherId);
                                    relations.push({
                                        title: otherAnime.title.english || otherAnime.title.romaji,
                                        type: edge.relationType === "PREQUEL" ? "SEQUEL" : (edge.relationType === "SEQUEL" ? "PREQUEL" : edge.relationType)
                                    });
                                }
                            });
                        }
                    });
                    // Once a node is hovered on, show the format, start/finish dates and a counter in case the user has rewatched this.
                    setHoveredAnimeInfo({
                        title: anime.title.english || anime.title.romaji,
                        format: anime.format,
                        startedAt: anime.startedAt,
                        completedAt: anime.completedAt,
                        repeat: anime.repeat,
                        relations: relations
                    });
                } else if (nodeId === aniUserDisplay) {
                    setHoveredAnimeInfo({
                        title: `${aniUserDisplay} (You)`,
                        isUser: true
                    });
                }
            }}
          onNodeClick={(nodeId) => {
              // When clicking on a node, if it's the user's node, then open their AniList profile on a new tab.
                if (nodeId === aniUserDisplay) {
                    const link = document.createElement("a");
                    link.href = `https://anilist.co/user/${encodeURIComponent(aniUserDisplay)}/`;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    return;
                }
              // Otherwise set SelectedAnimeId to the ID of the node clicked so the details panel can start loading a brief synopsis and the poster.
                setSelectedAnimeId(nodeId);
            }}
        />
        )}
        <AnimeDetailsPanel
            animeId={selectedAnimeId}
            onClose={() => setSelectedAnimeId(null)}
        />
        </div>
        </>
    )
}

export default App
