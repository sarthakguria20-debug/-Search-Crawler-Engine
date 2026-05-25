import { useState, useEffect } from "react";
import { Search, Activity, Link as LinkIcon, Database, CheckCircle2, RotateCw } from "lucide-react";
import { EngineStatus, SearchResponse } from "./types";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [crawlUrl, setCrawlUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Poll status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (e) {
        console.error("Failed to fetch status");
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crawlUrl) return;
    try {
      await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl }),
      });
      setCrawlUrl("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResponse(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResponse(data);
      }
    } catch (e) {
      console.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">IndexCore Engine v2.4</h1>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">High-Performance Domain Indexing</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
            <span className="relative flex h-2 w-2">
              {status?.isCrawling && (
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-700 uppercase">
              {status?.isCrawling ? "Crawling Active" : "System Ready"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4 overflow-hidden">
        
        {/* Left Sidebar: Crawler Panel */}
        <section className="md:col-span-4 lg:col-span-3 flex flex-col space-y-4 overflow-y-auto pr-2">
          
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Target Domain
             </h2>
             <form onSubmit={handleStartCrawl} className="space-y-4">
               <div>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                    disabled={status?.isCrawling}
                    className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 placeholder:font-normal disabled:opacity-50"
                    required
                  />
               </div>
               <button
                  type="submit"
                  disabled={status?.isCrawling}
                  className="w-full px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-md shadow hover:bg-slate-800 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {status?.isCrawling ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      Crawling...
                    </>
                 ) : (
                    "Build Index"
                 )}
               </button>
             </form>
          </div>

          <div className="flex-1 bg-slate-900 p-4 rounded-xl shadow-inner font-mono text-xs overflow-hidden flex flex-col min-h-[250px]">
             <h2 className="text-slate-500 uppercase font-bold mb-3">Live Index Logs</h2>
             <div className="space-y-2 overflow-y-auto opacity-80 flex-1">
                {status?.isCrawling ? (
                   <>
                     <p className="text-blue-400">[INFO] Worker threads analyzing paths...</p>
                     <p className="text-emerald-400">[SUCCESS] Connection active.</p>
                     {status.visitedUrlsCount > 0 && (
                        <p className="text-emerald-400">[SUCCESS] Crawled {status.visitedUrlsCount} pages.</p>
                     )}
                     <p className="text-green-300">[INFO] Indexing terms: {status.indexedTerms}</p>
                     <p className="text-amber-400">[WARN] Delaying between requests...</p>
                   </>
                ) : (
                   <p className="text-slate-500">[INFO] Waiting for crawler commands.</p>
                )}
             </div>
          </div>
        </section>

        {/* Center/Right: Search Space & Stats */}
        <section className="md:col-span-8 lg:col-span-9 flex flex-col space-y-4 min-h-0">
           {/* Top Stats Row */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
             <StatCard label="Pages Indexed" value={status?.indexedDocuments ?? 0} />
             <StatCard label="Terms Crawled" value={status?.indexedTerms ?? 0} />
             <StatCard label="Queue Size" value={status?.queueLength ?? 0} />
             <StatCard label="Avg Search Query" value={searchResponse ? searchResponse.timeMs + "ms" : "N/A"} color="text-blue-600" />
           </div>

           {/* Search Sandbox */}
           <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col min-h-0">
              <div className="mb-6 flex-shrink-0">
                 <h2 className="text-lg font-bold text-slate-900 mb-1">Inverted Index Search Sandbox</h2>
                 <p className="text-sm text-slate-500">Test the efficiency of the optimized lookup table.</p>
              </div>

              <form onSubmit={handleSearch} className="relative flex items-center mb-6 flex-shrink-0">
                 <input
                   type="text"
                   placeholder="Search the index (e.g. 'indexer')"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
                 />
                 <Search className="w-5 h-5 text-slate-400 absolute left-4" />
                 {searchResponse && (
                    <div className="absolute right-4 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 italic">
                      Returned in {searchResponse.timeMs}ms
                    </div>
                 )}
                 <button type="submit" className="hidden">Search</button>
              </form>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                 <AnimatePresence mode="wait">
                   {searchResponse ? (
                      <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                         {searchResponse.results.length === 0 ? (
                            <div className="text-slate-500 italic p-4 text-center">No matches found in the index.</div>
                         ) : (
                            searchResponse.results.map((result, idx) => (
                               <motion.div
                                 key={result.doc.id}
                                 initial={{ opacity: 0, y: 10 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 transition={{ delay: idx * 0.05 }}
                                 className="p-3 bg-slate-50 rounded-lg border-l-4 border-blue-500"
                               >
                                  <h3 className="text-sm font-bold text-slate-800">
                                    <a href={result.doc.url} target="_blank" rel="noreferrer" className="hover:underline">
                                      {result.doc.title || result.doc.url}
                                    </a>
                                  </h3>
                                  <p className="text-xs text-slate-500 line-clamp-1">{result.doc.url}</p>
                                  <p className="text-xs mt-1 text-slate-600">{result.doc.snippet}</p>
                                  <div className="mt-2 flex items-center space-x-2">
                                     <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        Score: {result.score.toFixed(2)}
                                     </span>
                                     <span className="text-[10px] bg-white px-1 py-0.5 rounded text-blue-500 border border-blue-100 font-mono">
                                        TF-IDF Map
                                     </span>
                                  </div>
                               </motion.div>
                            ))
                         )}
                      </motion.div>
                   ) : (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full flex flex-col justify-center items-center text-slate-400 space-y-4 pt-12"
                      >
                         <Database className="w-16 h-16 opacity-20" />
                         <p className="text-sm">Submit a URL to start building the inverted index.</p>
                      </motion.div>
                   )}
                 </AnimatePresence>
              </div>
           </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, color = "text-slate-900" }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-sm flex flex-col h-full justify-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter mt-1">{label}</p>
    </div>
  );
}
