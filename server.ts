import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";

// --- INVERTED INDEX --- //

interface DocumentInfo {
  id: string;
  url: string;
  title: string;
  snippet: string;
}

interface TermData {
  tf: number; // Term Frequency
  positions: number[];
}

interface SearchResult {
  doc: DocumentInfo;
  score: number;
}

class SearchEngine {
  private documents = new Map<string, DocumentInfo>();
  // Inverted index maps word -> documentId -> TermData
  private invertedIndex = new Map<string, Map<string, TermData>>();
  
  // Crawler state
  private visitedUrls = new Set<string>();
  private crawlQueue: string[] = [];
  public isCrawling = false;
  public maxPagesToCrawl = 20;

  tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 0);
  }

  addDocument(url: string, title: string, text: string) {
    const docId = url;
    if (this.documents.has(docId)) return; // Avoid duplicates

    const snippet = text.slice(0, 200).replace(/\s+/g, ' ') + '...';
    this.documents.set(docId, { id: docId, url, title, snippet });

    const tokens = this.tokenize(text);
    const tokenCounts = new Map<string, { tf: number, positions: number[] }>();

    tokens.forEach((token, index) => {
      if (!tokenCounts.has(token)) {
        tokenCounts.set(token, { tf: 0, positions: [] });
      }
      const data = tokenCounts.get(token)!;
      data.tf++;
      data.positions.push(index);
    });

    for (const [token, data] of tokenCounts.entries()) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Map());
      }
      this.invertedIndex.get(token)!.set(docId, data);
    }
  }

  search(query: string): SearchResult[] {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return [];

    const docScores = new Map<string, number>();
    const totalDocs = this.documents.size;

    for (const token of tokens) {
      const docMap = this.invertedIndex.get(token);
      if (!docMap) continue;

      // IDF (Inverse Document Frequency)
      const idf = Math.log10(totalDocs / docMap.size);

      for (const [docId, termData] of docMap.entries()) {
        const tf = termData.tf;
        const tfIdf = tf * idf; // Basic TF-IDF calculation
        docScores.set(docId, (docScores.get(docId) || 0) + tfIdf);
      }
    }

    const results: SearchResult[] = Array.from(docScores.entries())
      .map(([docId, score]) => ({
        doc: this.documents.get(docId)!,
        score
      }))
      .sort((a, b) => b.score - a.score);

    return results;
  }

  getStatus() {
    return {
      indexedDocuments: this.documents.size,
      indexedTerms: this.invertedIndex.size,
      isCrawling: this.isCrawling,
      visitedUrlsCount: this.visitedUrls.size,
      queueLength: this.crawlQueue.length,
    };
  }

  async startCrawl(startUrl: string) {
    if (this.isCrawling) return;
    this.isCrawling = true;
    
    // Reset crawler state but keep the index if they want to build onto it, 
    // or reset both depending on requirements. Let's keep index robust.
    // this.visitedUrls.clear(); // We keep visited so we don't recrawl same URLs on subsequent clicks
    this.crawlQueue = [startUrl];
    
    const startDomain = new URL(startUrl).hostname;
    let pagesCrawledInSession = 0;

    while (this.crawlQueue.length > 0 && pagesCrawledInSession < this.maxPagesToCrawl) {
      const currentUrl = this.crawlQueue.shift()!;
      
      // Normalize URL (strip hash)
      const urlObj = new URL(currentUrl);
      urlObj.hash = '';
      const normalizedUrl = urlObj.toString();

      if (this.visitedUrls.has(normalizedUrl)) continue;
      this.visitedUrls.add(normalizedUrl);
      pagesCrawledInSession++;

      try {
        const response = await fetch(normalizedUrl, {
          headers: { 'User-Agent': 'MiniSearchEngineBot / 1.0' }
        });

        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
          continue;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove script and style tags to get clean text
        $('script, style, noscript, svg').remove();
        
        const title = $('title').text() || normalizedUrl;
        const text = $('body').text().replace(/\s+/g, ' ');

        this.addDocument(normalizedUrl, title, text);

        // Extract Links
        $('a').each((_, element) => {
          const href = $(element).attr('href');
          if (!href) return;

          try {
            const resolvedUrl = new URL(href, normalizedUrl);
            resolvedUrl.hash = '';
            // Only crawl same domain
            if (resolvedUrl.hostname === startDomain && !this.visitedUrls.has(resolvedUrl.toString())) {
              this.crawlQueue.push(resolvedUrl.toString());
            }
          } catch (e) {
            // Invalid URL, safely ignore
          }
        });

      } catch (error) {
        console.error(`Failed to crawl ${normalizedUrl}:`, error);
      }
      
      // Prevent rapid fire hitting servers
      await new Promise(r => setTimeout(r, 200));
    }

    this.isCrawling = false;
  }
  
  clearIndex() {
      this.documents.clear();
      this.invertedIndex.clear();
      this.visitedUrls.clear();
      this.crawlQueue = [];
  }
}

const engine = new SearchEngine();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/crawl", async (req, res) => {
    const { url, clearFirst } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    try {
        new URL(url);
    } catch {
        return res.status(400).json({ error: "Invalid URL" });
    }

    if (clearFirst) {
        engine.clearIndex();
    }

    // Start crawl asynchronously
    engine.startCrawl(url);
    res.json({ message: "Crawl started", status: engine.getStatus() });
  });

  app.get("/api/search", (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.json([]);
    }
    
    // Performance timer
    const start = performance.now();
    const results = engine.search(query);
    const end = performance.now();
    
    res.json({
        timeMs: (end - start).toFixed(2),
        count: results.length,
        results: results.slice(0, 50) // Return top 50
    });
  });

  app.get("/api/status", (req, res) => {
    res.json(engine.getStatus());
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
