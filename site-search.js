/**
 * Sakhi 181 - Site-Wide Search Engine, Autocomplete & Results Page Controller
 * Covers Resources (static topics + Supabase centers & helplines), Cyber-Specific Resources,
 * Blog Posts (posts.json), and General Site Pages.
 */
(function () {
    'use strict';

    const SUPABASE_URL = 'https://ifasovihhhxznuvdgoxn.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmYXNvdmloaGh4em51dmRnb3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDIzMDgsImV4cCI6MjA5MTcxODMwOH0.iu5satWImQmodqy4FTXxWL6RZEUSVs22Y8Hnfh6753E';
    const DYNAMIC_CACHE_KEY = 'sakhi_search_dynamic_v1';
    const DYNAMIC_CACHE_TTL_MS = 10 * 60 * 1000;
    const RESULTS_PER_PAGE = 10;

    const CURATED_SUGGESTIONS = [
        'Sakhi One Stop Center',
        'Legal Aid',
        'Medical Help',
        'Counselling',
        'HIV support',
        'LGBTQIA+ Resources',
        'Government Helpline Numbers',
        'Intimate Image Leaks (NCII)',
        'StopNCII.org',
        'Take It Down (Minors)',
        'National Cyber Crime Reporting Portal',
        'Cybercrime Helpline 1930',
        'NCW Women Helpline 14490',
        'NALSA Free Legal Aid 15100',
        'Women Helpline 181',
        'TeleMANAS 14416',
        'Childline 1098 (POCSO)',
        'Deepfake / AI-Generated Images',
        'Sextortion & Blackmail',
        'Zero FIR',
        'BNS 2023 & IT Act',
        'IT Rules 2021 (24-Hour Takedown)',
        'Grievance Appellate Committee (GAC)',
        'Google Search Content Removal',
        'Digital Evidence Preservation',
        'CyberDost',
        'Digital Shakti Campaign',
        'CERT-In Mahila Suraksha Handbook',
        'Bhumika Support Centers',
        'Additional Resources',
        'Find A Helpline',
        'DomesticShelters.org',
        'Her Case Matters',
        'IWWAGE 181 Assessment',
        'Donate & 80G Tax Exemption'
    ];

    const POPULAR_SEARCH_CHIPS = [
        'Sakhi One Stop Center',
        'Legal Aid',
        'NCII',
        'StopNCII',
        '1930',
        'Counselling',
        'Deepfake',
        'Bhumika',
        '181'
    ];

    const TERM_EQUIVALENTS = {
        'counseling': ['counselling', 'counselor', 'counsellor'],
        'counselling': ['counseling', 'counselor', 'counsellor'],
        'counselor': ['counsellor', 'counselling', 'counseling'],
        'counsellor': ['counselor', 'counselling', 'counseling'],
        'center': ['centre', 'centers', 'centres'],
        'centre': ['center', 'centres', 'centers'],
        'centers': ['centres', 'center', 'centre'],
        'centres': ['centers', 'centre', 'center'],
        'cybercrime': ['cyber crime', 'cyber-crime'],
        'cyber crime': ['cybercrime'],
        'helpline': ['help line', 'helplines'],
        'helplines': ['helpline'],
        'lgbtq': ['lgbtqia+', 'lgbtqia'],
        'lgbtqia': ['lgbtqia+', 'lgbtq'],
        'ncii': ['intimate image', 'non-consensual intimate'],
        'bwc': ['bhumika'],
        'osc': ['one stop center', 'one stop centre', 'sakhi']
    };

    const STOP_WORDS = new Set([
        'a', 'an', 'the', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'at', 'by', 'is', 'are', 'with', 'from', 'as'
    ]);

    const FILTER_TYPES = [
        { id: 'all', label: 'All Results', icon: 'ri-apps-line' },
        { id: 'resources', label: 'Resources', icon: 'ri-heart-handshake-line' },
        { id: 'cyber', label: 'Cyber Resources', icon: 'ri-shield-keyhole-line' },
        { id: 'blog', label: 'Blog Posts', icon: 'ri-article-line' },
        { id: 'pages', label: 'Site Pages', icon: 'ri-pages-line' }
    ];

    let corpusPromise = null;
    let cachedCorpus = null;

    /**
     * Resolve relative paths cleanly even on Vercel rewritten routes like /blog/:slug
     */
    function getBasePrefix() {
        const path = window.location.pathname || '/';
        if (/^\/blog\/[^/]+/.test(path) && !path.endsWith('.html')) {
            return '/';
        }
        return '';
    }

    function resolveUrl(relPath) {
        if (!relPath) return '#';
        if (/^(https?:|mailto:|tel:|#|\/)/i.test(relPath)) return relPath;
        return getBasePrefix() + relPath;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeRegex(str) {
        return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function stripHtmlAndEntities(html) {
        if (!html) return '';
        const text = String(html)
            .replace(/<\/(p|div|li|h[1-6]|tr|td|th|br)>/gi, ' ')
            .replace(/<[^>]+>/g, ' ');
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value.replace(/\s+/g, ' ').trim();
    }

    /**
     * Expand a token with known spelling equivalents / synonyms.
     */
    function getTokenVariants(token) {
        const lower = token.toLowerCase();
        const variants = new Set([lower]);
        if (TERM_EQUIVALENTS[lower]) {
            TERM_EQUIVALENTS[lower].forEach((v) => variants.add(v));
        }
        return Array.from(variants);
    }

    /**
     * Parse query into exact-phrase mode, normalized phrase, and search tokens.
     */
    function parseQuery(rawQuery) {
        const trimmed = String(rawQuery || '').trim();
        const isQuoted = /^".+"$/.test(trimmed) && trimmed.length > 2;
        const clean = isQuoted ? trimmed.slice(1, -1).trim() : trimmed;
        const lowerPhrase = clean.replace(/\s+/g, ' ').toLowerCase();
        const rawTokens = lowerPhrase.split(/\s+/).filter(Boolean);
        const meaningfulTokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
        const tokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

        return {
            raw: trimmed,
            clean,
            lowerPhrase,
            isQuoted,
            tokens
        };
    }

    /**
     * Safely highlight query phrases/tokens inside plain text using <mark class="search-highlight">.
     */
    function highlightText(plainText, rawQuery) {
        const text = String(plainText || '');
        if (!text) return '';
        const parsed = parseQuery(rawQuery);
        if (!parsed.clean) return escapeHtml(text);

        const terms = new Set();
        if (parsed.clean.length >= 2) {
            terms.add(parsed.clean);
            if (TERM_EQUIVALENTS[parsed.lowerPhrase]) {
                TERM_EQUIVALENTS[parsed.lowerPhrase].forEach((v) => terms.add(v));
            }
        }
        if (!parsed.isQuoted) {
            parsed.tokens.forEach((tok) => {
                if (tok.length >= 2 || /^\d+$/.test(tok)) {
                    getTokenVariants(tok).forEach((v) => terms.add(v));
                }
            });
        }

        const patternList = Array.from(terms)
            .filter(Boolean)
            .sort((a, b) => b.length - a.length)
            .map(escapeRegex);

        if (patternList.length === 0) return escapeHtml(text);

        const regex = new RegExp(`(${patternList.join('|')})`, 'gi');
        const parts = text.split(regex);
        let html = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;
            // Odd indices are captured group matches when splitting on a single capturing group
            if (i % 2 === 1) {
                html += `<mark class="search-highlight">${escapeHtml(part)}</mark>`;
            } else {
                html += escapeHtml(part);
            }
        }
        return html;
    }

    /**
     * Load static index + posts.json + live Supabase centers & helplines.
     */
    async function loadSearchCorpus() {
        if (cachedCorpus) return cachedCorpus;
        if (corpusPromise) return corpusPromise;

        corpusPromise = (async () => {
            const baseItems = [];
            const itemMap = new Map();

            const addItem = (item) => {
                if (!item || !item.id) return;
                item._titleLower = (item.title || '').toLowerCase();
                item._descLower = (item.description || '').toLowerCase();
                item._keywordsLower = (item.keywords || '').toLowerCase();
                item._textLower = (item.text || '').toLowerCase();
                item._combinedLower = `${item._titleLower} ${item._keywordsLower} ${item._descLower} ${item._textLower}`;
                if (Array.isArray(item.sections)) {
                    item.sections.forEach((s) => {
                        s._titleLower = (s.title || '').toLowerCase();
                        s._textLower = (s.text || '').toLowerCase();
                    });
                }
                itemMap.set(item.id, item);
            };

            const [indexRes, postsRes, dynamicRes] = await Promise.allSettled([
                fetch(resolveUrl('search-index.json')),
                fetch(resolveUrl('posts.json')),
                fetchDynamicResources()
            ]);

            if (indexRes.status === 'fulfilled' && indexRes.value.ok) {
                try {
                    const data = await indexRes.value.json();
                    if (Array.isArray(data.items)) {
                        data.items.forEach(addItem);
                    }
                } catch (e) {
                    console.warn('Could not parse search-index.json', e);
                }
            }

            // Merge live posts.json so newly added blog posts are always included
            if (postsRes.status === 'fulfilled' && postsRes.value.ok) {
                try {
                    const posts = await postsRes.value.json();
                    if (Array.isArray(posts)) {
                        posts.forEach((post) => {
                            if (post.published === false) return;
                            const plain = stripHtmlAndEntities(post.content || '');
                            addItem({
                                id: `blog-${post.slug}`,
                                url: `blog-post.html?slug=${encodeURIComponent(post.slug)}`,
                                title: post.title,
                                description: post.excerpt || plain.slice(0, 220),
                                type: 'blog',
                                typeLabel: 'Blog Post',
                                date: post.date || '',
                                image: post.coverImage || '',
                                keywords: `${post.title}, blog, story, ${post.excerpt || ''}`,
                                sections: [],
                                text: plain
                            });
                        });
                    }
                } catch (e) {
                    console.warn('Could not parse posts.json', e);
                }
            }

            // Merge dynamic Supabase centers & government helplines
            if (dynamicRes.status === 'fulfilled' && Array.isArray(dynamicRes.value)) {
                dynamicRes.value.forEach(addItem);
            }

            itemMap.forEach((val) => baseItems.push(val));

            const suggestionSet = new Set(CURATED_SUGGESTIONS);
            const vocabSet = new Set();

            baseItems.forEach((item) => {
                if (item.title) suggestionSet.add(item.title.split(' — ')[0].trim());
                if (item.badgeMeta) {
                    item.badgeMeta.split(/[,\n;/|]+/).forEach((tag) => {
                        const t = tag.trim();
                        if (t.length > 2) suggestionSet.add(t);
                    });
                }
                if (item.district) suggestionSet.add(item.district.trim());
                if (Array.isArray(item.sections)) {
                    item.sections.forEach((sec) => {
                        const cleanHeading = (sec.title || '').replace(/^\d+\.\s*/, '').trim();
                        if (cleanHeading.length > 3 && cleanHeading.length <= 65) {
                            suggestionSet.add(cleanHeading);
                        }
                    });
                }
                const words = `${item.title} ${item.keywords} ${item.description}`.toLowerCase().match(/[a-z0-9+]{3,}/g);
                if (words) {
                    words.forEach((w) => vocabSet.add(w));
                }
            });

            cachedCorpus = {
                items: baseItems,
                suggestions: Array.from(suggestionSet),
                vocab: Array.from(vocabSet)
            };
            return cachedCorpus;
        })();

        return corpusPromise;
    }

    async function fetchDynamicResources() {
        try {
            const cachedRaw = sessionStorage.getItem(DYNAMIC_CACHE_KEY);
            if (cachedRaw) {
                const parsed = JSON.parse(cachedRaw);
                if (parsed && (Date.now() - parsed.timestamp) < DYNAMIC_CACHE_TTL_MS && Array.isArray(parsed.items)) {
                    return parsed.items;
                }
            }
        } catch (_) {
            // Ignore storage access errors
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);
        const headers = {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        };

        try {
            const [centersRes, helplinesRes] = await Promise.allSettled([
                fetch(`${SUPABASE_URL}/rest/v1/centers?select=*`, { headers, signal: controller.signal }),
                fetch(`${SUPABASE_URL}/rest/v1/government_helplines?select=*`, { headers, signal: controller.signal })
            ]);
            clearTimeout(timeoutId);

            const dynamicItems = [];

            if (centersRes.status === 'fulfilled' && centersRes.value.ok) {
                const centers = await centersRes.value.json();
                if (Array.isArray(centers)) {
                    centers.forEach((c) => {
                        const name = c.Name || 'Support Center';
                        const district = c.District || '';
                        const category = c.Category || 'Support Center';
                        const services = c['Services provided'] || c['Services Provided'] || '';
                        const address = c.Address || '';
                        const pincode = c.Pincode || '';
                        const orgType = c['NGO/GOVT/Pvt'] || '';
                        const phone = c['Phone Number'] || '';
                        const contact = c['Point of Contact'] || '';
                        const email = c.Email || '';
                        const website = c.Website || '';

                        const displayTitle = district && !name.toLowerCase().includes(district.toLowerCase())
                            ? `${name} — ${district}`
                            : name;

                        dynamicItems.push({
                            id: `center-${c.id}`,
                            url: `details.html?id=${encodeURIComponent(c.id)}`,
                            title: displayTitle,
                            description: [category, services, address].filter(Boolean).join(' • '),
                            type: 'resources',
                            typeLabel: 'Verified Center',
                            badgeMeta: category.split(/[,\n;/|]+/)[0].trim(),
                            district,
                            pincode,
                            keywords: [name, category, district, pincode, orgType, services, contact].filter(Boolean).join(', '),
                            sections: [],
                            text: [name, category, orgType, district, pincode, address, services, contact, phone, email, website].filter(Boolean).join(' ')
                        });
                    });
                }
            }

            if (helplinesRes.status === 'fulfilled' && helplinesRes.value.ok) {
                const helplines = await helplinesRes.value.json();
                if (Array.isArray(helplines)) {
                    helplines.forEach((h) => {
                        const name = h.Name || 'Government Helpline';
                        const number = (h.Number || '').toString().trim();
                        const level = h['National / State'] || 'National';
                        const category = h.Category || 'Government Helpline Number';
                        const services = h['Services Provided'] || h['Services provided'] || '';
                        const langs = h['Languages Supported'] || '';
                        const website = h.Website || '';

                        dynamicItems.push({
                            id: `helpline-${h.id}`,
                            url: `resources.html?category=${encodeURIComponent('Government Helpline Number')}`,
                            title: number ? `${name} (Helpline ${number})` : name,
                            description: [`${level} Toll-Free Helpline`, services, category].filter(Boolean).join(' • '),
                            type: 'resources',
                            typeLabel: 'Govt Helpline',
                            badgeMeta: `${level} Helpline`,
                            keywords: [name, number, category, services, level, 'government helpline', 'toll-free'].filter(Boolean).join(', '),
                            sections: [],
                            text: [name, number, level, category, services, langs, website].filter(Boolean).join(' ')
                        });
                    });
                }
            }

            if (dynamicItems.length > 0) {
                try {
                    sessionStorage.setItem(DYNAMIC_CACHE_KEY, JSON.stringify({
                        timestamp: Date.now(),
                        items: dynamicItems
                    }));
                } catch (_) {
                    // Ignore storage quota errors
                }
            }

            return dynamicItems;
        } catch (err) {
            clearTimeout(timeoutId);
            console.warn('Dynamic resource search fetch skipped:', err.message || err);
            return [];
        }
    }

    function containsAnyVariant(haystackLower, token) {
        const variants = getTokenVariants(token);
        return variants.some((v) => haystackLower.includes(v));
    }

    function countOccurrences(haystackLower, termLower) {
        if (!termLower) return 0;
        let count = 0;
        let pos = haystackLower.indexOf(termLower);
        while (pos !== -1 && count < 10) {
            count++;
            pos = haystackLower.indexOf(termLower, pos + termLower.length);
        }
        return count;
    }

    /**
     * Score an indexed item against a parsed query. Returns null if no match.
     */
    function scoreItem(item, parsed) {
        if (!parsed.clean) return null;

        const phraseVariants = getTokenVariants(parsed.lowerPhrase);
        const hasExactPhraseInCombined = phraseVariants.some((p) => item._combinedLower.includes(p));

        if (parsed.isQuoted && !hasExactPhraseInCombined) {
            return null;
        }

        // Require all meaningful tokens to appear somewhere in the item (AND logic)
        const allTokensPresent = parsed.tokens.every((tok) => containsAnyVariant(item._combinedLower, tok));
        if (!allTokensPresent && !hasExactPhraseInCombined) {
            return null;
        }

        let score = 0;

        // Exact phrase boosts
        phraseVariants.forEach((phrase) => {
            if (item._titleLower === phrase) score += 220;
            else if (item._titleLower.includes(phrase)) score += 130;
            if (item._keywordsLower.includes(phrase)) score += 65;
            if (item._descLower.includes(phrase)) score += 50;
            if (item._textLower.includes(phrase)) score += 30;
        });

        // Token-level scoring
        parsed.tokens.forEach((tok) => {
            const variants = getTokenVariants(tok);
            let titleHit = false;
            let kwHit = false;
            let descHit = false;
            let bodyHits = 0;

            variants.forEach((v) => {
                if (item._titleLower.includes(v)) titleHit = true;
                if (item._keywordsLower.includes(v)) kwHit = true;
                if (item._descLower.includes(v)) descHit = true;
                bodyHits += countOccurrences(item._textLower, v);
            });

            if (titleHit) score += 30;
            if (kwHit) score += 14;
            if (descHit) score += 12;
            score += Math.min(bodyHits, 6) * 3;
        });

        // Priority boost for curated site pages & blog posts so guides appear alongside center directories
        if (item.id.startsWith('page-') || item.id.startsWith('blog-')) {
            score += 18;
        }

        // Find matching sections inside the page for deep-linking & targeted snippets
        let bestSection = null;
        const matchedSections = [];

        if (Array.isArray(item.sections) && item.sections.length > 0) {
            item.sections.forEach((sec) => {
                const secCombined = `${sec._titleLower} ${sec._textLower}`;
                const secHasPhrase = phraseVariants.some((p) => secCombined.includes(p));
                const secAllTokens = parsed.tokens.every((tok) => containsAnyVariant(secCombined, tok));
                if (!secHasPhrase && !secAllTokens && !parsed.tokens.some((tok) => containsAnyVariant(sec._titleLower, tok))) {
                    return;
                }

                let secScore = 0;
                phraseVariants.forEach((p) => {
                    if (sec._titleLower.includes(p)) secScore += 100;
                    if (sec._textLower.includes(p)) secScore += 45;
                });
                parsed.tokens.forEach((tok) => {
                    if (containsAnyVariant(sec._titleLower, tok)) secScore += 25;
                    if (containsAnyVariant(sec._textLower, tok)) secScore += 8;
                });

                matchedSections.push({ title: sec.title, url: sec.url, text: sec.text, score: secScore });
            });

            matchedSections.sort((a, b) => b.score - a.score);
            if (matchedSections.length > 0) {
                bestSection = matchedSections[0];
            }
        }

        return {
            item,
            score,
            bestSection,
            matchedSections: matchedSections.slice(0, 3)
        };
    }

    function searchCorpus(rawQuery, corpus) {
        const parsed = parseQuery(rawQuery);
        if (!parsed.clean || !corpus || !Array.isArray(corpus.items)) {
            return [];
        }

        const results = [];
        for (const item of corpus.items) {
            const scored = scoreItem(item, parsed);
            if (scored) results.push(scored);
        }

        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (a.item.title || '').localeCompare(b.item.title || '');
        });

        return results;
    }

    /**
     * Build a context snippet centered around the first matched term/phrase.
     */
    function buildSnippet(item, bestSection, rawQuery) {
        const parsed = parseQuery(rawQuery);
        const candidates = [];
        if (bestSection && bestSection.text) candidates.push(bestSection.text);
        if (item.description) candidates.push(item.description);
        if (item.text) candidates.push(item.text);

        const searchTerms = [parsed.lowerPhrase, ...parsed.tokens]
            .flatMap((t) => getTokenVariants(t))
            .filter((t) => t && t.length >= 2);

        for (const sourceText of candidates) {
            const lower = sourceText.toLowerCase();
            let matchIdx = -1;
            for (const term of searchTerms) {
                const idx = lower.indexOf(term);
                if (idx !== -1 && (matchIdx === -1 || idx < matchIdx)) {
                    matchIdx = idx;
                }
            }

            if (matchIdx !== -1) {
                const windowSize = 215;
                let start = Math.max(0, matchIdx - 75);
                let end = Math.min(sourceText.length, start + windowSize);
                if (end - start < windowSize && start > 0) {
                    start = Math.max(0, end - windowSize);
                }

                // Snap cleanly to word boundaries
                if (start > 0) {
                    const spaceAfter = sourceText.indexOf(' ', start);
                    if (spaceAfter !== -1 && spaceAfter < matchIdx) start = spaceAfter + 1;
                }
                if (end < sourceText.length) {
                    const spaceBefore = sourceText.lastIndexOf(' ', end);
                    if (spaceBefore > matchIdx) end = spaceBefore;
                }

                const prefix = start > 0 ? '...' : '';
                const suffix = end < sourceText.length ? '...' : '';
                return `${prefix}${sourceText.slice(start, end).trim()}${suffix}`;
            }
        }

        const fallback = item.description || item.text || '';
        return fallback.length > 215 ? `${fallback.slice(0, 212).trim()}...` : fallback;
    }

    /**
     * Levenshtein distance for "Did you mean...?" typo recovery and fuzzy autocomplete.
     */
    function editDistance(a, b) {
        const m = a.length;
        const n = b.length;
        if (Math.abs(m - n) > 3) return 99;
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[m][n];
    }

    function getDidYouMeanSuggestions(rawQuery, corpus) {
        const clean = String(rawQuery || '').trim().toLowerCase();
        if (!clean || clean.length < 3 || !corpus) return [];

        const candidates = [];
        const seen = new Set();
        const canonicalSeen = new Set();

        const evaluateCandidate = (term, isCurated) => {
            const lower = term.toLowerCase();
            if (seen.has(lower) || lower === clean) return;
            seen.add(lower);

            const maxDist = clean.length <= 5 ? 2 : 3;
            let bestDist = editDistance(clean, lower);
            if (bestDist > maxDist) {
                const words = lower.split(/\s+/);
                for (const w of words) {
                    if (w.length >= 4) {
                        const wd = editDistance(clean, w);
                        if (wd <= 2) {
                            bestDist = Math.min(bestDist, wd + 0.4);
                        }
                    }
                }
            }

            if (bestDist <= maxDist) {
                // Curated phrases & titles get slight priority over raw lowercase vocabulary tokens
                const score = bestDist - (isCurated ? 0.35 : 0);
                candidates.push({ term, score, lower });
            }
        };

        corpus.suggestions.forEach((term) => evaluateCandidate(term, true));
        corpus.vocab.forEach((term) => evaluateCandidate(term, false));

        candidates.sort((a, b) => a.score - b.score || a.term.length - b.term.length);

        const uniqueResults = [];
        for (const c of candidates) {
            const variants = getTokenVariants(c.lower);
            const canonicalKey = variants.slice().sort()[0] || c.lower;
            if (canonicalSeen.has(canonicalKey)) continue;
            canonicalSeen.add(canonicalKey);
            uniqueResults.push(c.term);
            if (uniqueResults.length >= 3) break;
        }
        return uniqueResults;
    }

    /**
     * Build autocomplete suggestions (suggested search terms + quick top page previews).
     */
    function getAutocompleteData(rawQuery, corpus) {
        const clean = String(rawQuery || '').trim();
        const lower = clean.toLowerCase();
        if (!clean || !corpus) return { suggestions: [], quickHits: [] };

        const scoredTerms = [];
        const seenLower = new Set();

        for (const term of corpus.suggestions) {
            const tLower = term.toLowerCase();
            if (seenLower.has(tLower)) continue;
            seenLower.add(tLower);

            let weight = 0;
            if (tLower === lower) continue; // Don't suggest exact same text already typed
            if (tLower.startsWith(lower)) {
                weight = 100 - Math.min(tLower.length, 60);
            } else if (tLower.split(/\s+/).some((w) => w.startsWith(lower))) {
                weight = 75 - Math.min(tLower.length, 50);
            } else if (tLower.includes(lower)) {
                weight = 50 - Math.min(tLower.length, 40);
            }

            if (weight > 0) {
                scoredTerms.push({ term, weight });
            }
        }

        scoredTerms.sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));
        let suggestions = scoredTerms.slice(0, 5).map((s) => s.term);

        if (suggestions.length === 0 && clean.length >= 3) {
            suggestions = getDidYouMeanSuggestions(clean, corpus);
        }

        const quickHits = searchCorpus(clean, corpus).slice(0, 4);
        return { suggestions, quickHits };
    }

    function getBadgeStyleClass(type) {
        switch (type) {
            case 'cyber': return 'badge-cyber';
            case 'blog': return 'badge-blog';
            case 'resources': return 'badge-resources';
            default: return 'badge-pages';
        }
    }

    function navigateToSearchPage(query, type = 'all') {
        const clean = String(query || '').trim();
        const params = new URLSearchParams();
        if (clean) params.set('q', clean);
        if (type && type !== 'all') params.set('type', type);
        const qs = params.toString();
        window.location.href = resolveUrl(qs ? `search.html?${qs}` : 'search.html');
    }

    /**
     * Render autocomplete dropdown items cleanly inside any container.
     */
    function renderAutocompleteDropdown(containerEl, query, data, onPickTerm) {
        if (!containerEl) return;
        const { suggestions, quickHits } = data;
        const clean = String(query || '').trim();

        if (!clean || (suggestions.length === 0 && quickHits.length === 0)) {
            containerEl.innerHTML = '';
            containerEl.hidden = true;
            return;
        }

        let html = '';

        if (suggestions.length > 0) {
            html += `<div class="search-ac-group-label">Suggested Searches</div>`;
            suggestions.forEach((term) => {
                html += `
                    <button type="button" class="search-ac-item" role="option" data-ac-kind="term" data-term="${escapeHtml(term)}">
                        <i class="ri-search-line search-ac-icon"></i>
                        <span class="search-ac-text">${highlightText(term, clean)}</span>
                        <span class="search-ac-hint">Search</span>
                    </button>
                `;
            });
        }

        if (quickHits.length > 0) {
            html += `<div class="search-ac-group-label">Matching Pages &amp; Resources</div>`;
            quickHits.forEach(({ item, bestSection }) => {
                const targetUrl = resolveUrl((bestSection && bestSection.url) || item.url);
                html += `
                    <a href="${escapeHtml(targetUrl)}" class="search-ac-item" role="option" data-ac-kind="link">
                        <i class="ri-file-text-line search-ac-icon"></i>
                        <span class="search-ac-text">${highlightText(item.title, clean)}</span>
                        <span class="search-ac-badge ${getBadgeStyleClass(item.type)}">${escapeHtml(item.typeLabel)}</span>
                    </a>
                `;
            });
        }

        html += `
            <button type="button" class="search-ac-footer" role="option" data-ac-kind="submit" data-term="${escapeHtml(clean)}">
                <span>View all results for &ldquo;<strong>${escapeHtml(clean)}</strong>&rdquo;</span>
                <i class="ri-arrow-right-line"></i>
            </button>
        `;

        containerEl.innerHTML = html;
        containerEl.hidden = false;

        containerEl.querySelectorAll('[data-ac-kind="term"], [data-ac-kind="submit"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const term = btn.getAttribute('data-term') || clean;
                onPickTerm(term);
            });
        });
    }

    /**
     * Wire keyboard navigation (ArrowDown / ArrowUp / Enter / Escape) onto an input + autocomplete listbox.
     */
    function bindAutocompleteKeyboard(inputEl, listEl, onSubmit) {
        let activeIdx = -1;

        const resetIndex = () => {
            activeIdx = -1;
            listEl.querySelectorAll('.search-ac-item, .search-ac-footer').forEach((el) => {
                el.classList.remove('is-focused');
                el.setAttribute('aria-selected', 'false');
            });
        };

        inputEl.addEventListener('keydown', (e) => {
            if (listEl.hidden) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onSubmit(inputEl.value);
                }
                return;
            }

            const options = Array.from(listEl.querySelectorAll('.search-ac-item, .search-ac-footer'));
            if (options.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIdx = (activeIdx + 1) % options.length;
                options.forEach((el, idx) => {
                    const active = idx === activeIdx;
                    el.classList.toggle('is-focused', active);
                    el.setAttribute('aria-selected', active ? 'true' : 'false');
                    if (active) el.scrollIntoView({ block: 'nearest' });
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIdx = activeIdx <= 0 ? options.length - 1 : activeIdx - 1;
                options.forEach((el, idx) => {
                    const active = idx === activeIdx;
                    el.classList.toggle('is-focused', active);
                    el.setAttribute('aria-selected', active ? 'true' : 'false');
                    if (active) el.scrollIntoView({ block: 'nearest' });
                });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIdx >= 0 && options[activeIdx]) {
                    options[activeIdx].click();
                } else {
                    onSubmit(inputEl.value);
                }
            } else if (e.key === 'Escape') {
                listEl.hidden = true;
                resetIndex();
            }
        });

        return resetIndex;
    }

    /**
     * Global Navbar Search Modal (triggered by #siteSearchBtn on every page).
     */
    function initGlobalSearchModal() {
        const triggerBtn = document.getElementById('siteSearchBtn');
        if (!triggerBtn) return;

        const overlay = document.createElement('div');
        overlay.id = 'siteSearchOverlay';
        overlay.className = 'site-search-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Search Sakhi 181 Website');
        overlay.hidden = true;

        const chipsHtml = POPULAR_SEARCH_CHIPS.map((chip) =>
            `<button type="button" class="search-chip-btn" data-search-chip="${escapeHtml(chip)}">${escapeHtml(chip)}</button>`
        ).join('');

        overlay.innerHTML = `
            <div class="site-search-backdrop" data-close-search="true"></div>
            <div class="site-search-modal">
                <div class="site-search-modal-header">
                    <div class="site-search-modal-title">
                        <i class="ri-search-2-line"></i>
                        <span>Search Sakhi 181</span>
                    </div>
                    <button type="button" class="site-search-close" id="siteSearchClose" aria-label="Close search">
                        <i class="ri-close-line"></i>
                    </button>
                </div>
                <form id="siteSearchModalForm" class="site-search-form" role="search">
                    <div class="site-search-input-wrap">
                        <i class="ri-search-line site-search-input-icon"></i>
                        <input
                            type="text"
                            id="siteSearchModalInput"
                            class="site-search-input"
                            placeholder="Search resources, cyber safety, helplines, blog posts..."
                            autocomplete="off"
                            aria-label="Search resources, cyber resources, and blog posts"
                            aria-autocomplete="list"
                            aria-controls="siteSearchModalAc"
                        >
                        <button type="button" class="site-search-clear" id="siteSearchModalClear" aria-label="Clear search" hidden>
                            <i class="ri-close-circle-fill"></i>
                        </button>
                        <button type="submit" class="site-search-submit">
                            <span>Search</span>
                            <i class="ri-arrow-right-line"></i>
                        </button>
                    </div>
                    <div id="siteSearchModalAc" class="search-autocomplete-dropdown" role="listbox" hidden></div>
                </form>
                <div id="siteSearchPopular" class="site-search-popular">
                    <div class="site-search-popular-label">Popular Topics &amp; Helplines</div>
                    <div class="search-chips-wrap">${chipsHtml}</div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const inputEl = document.getElementById('siteSearchModalInput');
        const clearBtn = document.getElementById('siteSearchModalClear');
        const closeBtn = document.getElementById('siteSearchClose');
        const formEl = document.getElementById('siteSearchModalForm');
        const acList = document.getElementById('siteSearchModalAc');
        const popularBox = document.getElementById('siteSearchPopular');

        let debounceTimer = null;

        const openModal = () => {
            overlay.hidden = false;
            requestAnimationFrame(() => overlay.classList.add('is-open'));
            triggerBtn.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
            loadSearchCorpus();
            setTimeout(() => inputEl.focus(), 50);
        };

        const closeModal = () => {
            overlay.classList.remove('is-open');
            triggerBtn.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            setTimeout(() => {
                overlay.hidden = true;
            }, 180);
            triggerBtn.focus();
        };

        const submitQuery = (val) => {
            const trimmed = String(val || '').trim();
            if (!trimmed) {
                inputEl.focus();
                return;
            }
            if (document.getElementById('searchResultsPage')) {
                // Already on search.html: update directly without full reload
                closeModal();
                window.dispatchEvent(new CustomEvent('sakhi:executeSearch', { detail: { query: trimmed, type: 'all', page: 1 } }));
                return;
            }
            navigateToSearchPage(trimmed);
        };

        const resetAcIdx = bindAutocompleteKeyboard(inputEl, acList, submitQuery);

        triggerBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        overlay.querySelector('[data-close-search="true"]').addEventListener('click', closeModal);

        // Keyboard shortcut '/' or Ctrl/Cmd+K
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !overlay.hidden) {
                closeModal();
                return;
            }
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);
            if (!isEditable && ((e.key === '/' && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
                e.preventDefault();
                openModal();
            }
        });

        formEl.addEventListener('submit', (e) => {
            e.preventDefault();
            submitQuery(inputEl.value);
        });

        clearBtn.addEventListener('click', () => {
            inputEl.value = '';
            clearBtn.hidden = true;
            acList.hidden = true;
            popularBox.hidden = false;
            resetAcIdx();
            inputEl.focus();
        });

        overlay.querySelectorAll('[data-search-chip]').forEach((chip) => {
            chip.addEventListener('click', () => {
                submitQuery(chip.getAttribute('data-search-chip'));
            });
        });

        inputEl.addEventListener('input', () => {
            const val = inputEl.value;
            clearBtn.hidden = val.length === 0;
            popularBox.hidden = val.trim().length > 0;
            resetAcIdx();

            clearTimeout(debounceTimer);
            if (!val.trim()) {
                acList.hidden = true;
                return;
            }

            debounceTimer = setTimeout(async () => {
                const corpus = await loadSearchCorpus();
                const acData = getAutocompleteData(val, corpus);
                renderAutocompleteDropdown(acList, val, acData, submitQuery);
            }, 80);
        });
    }

    /**
     * Search Results Page Controller (search.html).
     */
    function initSearchResultsPage() {
        const pageRoot = document.getElementById('searchResultsPage');
        if (!pageRoot) return;

        const formEl = document.getElementById('pageSearchForm');
        const inputEl = document.getElementById('pageSearchInput');
        const clearBtn = document.getElementById('pageSearchClear');
        const acList = document.getElementById('pageSearchAc');
        const filterBar = document.getElementById('searchFilterBar');
        const statusEl = document.getElementById('searchSummaryText');
        const resultsEl = document.getElementById('searchResultsList');
        const paginationEl = document.getElementById('searchPagination');

        const state = {
            query: '',
            type: 'all',
            page: 1
        };

        const readUrlState = () => {
            const params = new URLSearchParams(window.location.search);
            state.query = (params.get('q') || '').trim();
            const reqType = params.get('type') || 'all';
            state.type = FILTER_TYPES.some((f) => f.id === reqType) ? reqType : 'all';
            const p = parseInt(params.get('page') || '1', 10);
            state.page = Number.isFinite(p) && p > 0 ? p : 1;
        };

        const writeUrlState = (replace = false) => {
            const params = new URLSearchParams();
            if (state.query) params.set('q', state.query);
            if (state.type !== 'all') params.set('type', state.type);
            if (state.page > 1) params.set('page', String(state.page));
            const qs = params.toString();
            const target = qs ? `search.html?${qs}` : 'search.html';
            if (replace) {
                window.history.replaceState({ ...state }, '', target);
            } else {
                window.history.pushState({ ...state }, '', target);
            }
            document.title = state.query
                ? `Search: "${state.query}" | Sakhi 181`
                : 'Search Website | Sakhi 181';
        };

        const renderFilters = (allMatches) => {
            const counts = { all: allMatches.length, resources: 0, cyber: 0, blog: 0, pages: 0 };
            allMatches.forEach((m) => {
                if (counts[m.item.type] !== undefined) counts[m.item.type]++;
            });

            filterBar.innerHTML = FILTER_TYPES.map((f) => {
                const isActive = state.type === f.id;
                const count = counts[f.id] || 0;
                return `
                    <button type="button" class="filter-pill ${isActive ? 'active' : ''}" data-filter-type="${f.id}">
                        <i class="${f.icon}"></i>
                        <span>${escapeHtml(f.label)}</span>
                        <span class="filter-count-badge">${count}</span>
                    </button>
                `;
            }).join('');

            filterBar.querySelectorAll('[data-filter-type]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    state.type = btn.getAttribute('data-filter-type') || 'all';
                    state.page = 1;
                    writeUrlState();
                    executeAndRender();
                });
            });
        };

        const renderEmptyState = (corpus, allMatches) => {
            const totalAll = allMatches.length;

            // Case 1: User hasn't typed a query yet
            if (!state.query) {
                statusEl.innerHTML = 'Enter a keyword or phrase above to search across Sakhi 181 resources, cyber safety guides, and blog posts.';
                filterBar.innerHTML = '';
                paginationEl.innerHTML = '';

                const chipsHtml = POPULAR_SEARCH_CHIPS.map((chip) =>
                    `<button type="button" class="search-chip-btn" data-suggest-query="${escapeHtml(chip)}">${escapeHtml(chip)}</button>`
                ).join('');

                resultsEl.innerHTML = `
                    <div class="search-empty-card">
                        <div class="search-empty-icon"><i class="ri-search-eye-line"></i></div>
                        <h2>What are you looking for?</h2>
                        <p>Search across verified support centers, government helplines, Cyber-GBV &amp; NCII response guides, and blog stories.</p>
                        <div class="search-empty-suggestions">
                            <h3>Popular Searches</h3>
                            <div class="search-chips-wrap" style="justify-content: center;">${chipsHtml}</div>
                        </div>
                        <div class="search-quick-browse">
                            <a href="resources.html" class="search-browse-link"><i class="ri-heart-handshake-line"></i> Browse Resource Center</a>
                            <a href="cyber-gbv.html" class="search-browse-link"><i class="ri-shield-keyhole-line"></i> Cyber GBV Hub</a>
                            <a href="blog.html" class="search-browse-link"><i class="ri-article-line"></i> Read Blog</a>
                        </div>
                    </div>
                `;
                bindEmptyStateTriggers();
                return;
            }

            // Case 2: Query produced 0 matches in the selected filter, or 0 overall
            paginationEl.innerHTML = '';

            if (totalAll > 0 && state.type !== 'all') {
                const activeFilterObj = FILTER_TYPES.find((f) => f.id === state.type);
                const otherBreakdown = FILTER_TYPES
                    .filter((f) => f.id !== 'all' && f.id !== state.type)
                    .map((f) => {
                        const c = allMatches.filter((m) => m.item.type === f.id).length;
                        return c > 0 ? `<button type="button" class="search-chip-btn" data-switch-filter="${f.id}">${escapeHtml(f.label)} (${c})</button>` : '';
                    })
                    .filter(Boolean)
                    .join('');

                resultsEl.innerHTML = `
                    <div class="search-empty-card">
                        <div class="search-empty-icon"><i class="ri-filter-off-line"></i></div>
                        <h2>No results found in ${escapeHtml(activeFilterObj ? activeFilterObj.label : state.type)}</h2>
                        <p>We couldn&rsquo;t find matches for <strong>&ldquo;${escapeHtml(state.query)}&rdquo;</strong> under this filter, but there ${totalAll === 1 ? 'is' : 'are'} <strong>${totalAll}</strong> match${totalAll === 1 ? '' : 'es'} in other sections.</p>
                        <div class="search-empty-suggestions">
                            <h3>Try viewing matches in:</h3>
                            <div class="search-chips-wrap" style="justify-content: center;">
                                <button type="button" class="search-chip-btn is-primary" data-switch-filter="all">Show All Results (${totalAll})</button>
                                ${otherBreakdown}
                            </div>
                        </div>
                    </div>
                `;
                resultsEl.querySelectorAll('[data-switch-filter]').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        state.type = btn.getAttribute('data-switch-filter') || 'all';
                        state.page = 1;
                        writeUrlState();
                        executeAndRender();
                    });
                });
                return;
            }

            // Case 3: Truly 0 results across the entire website
            const didYouMean = getDidYouMeanSuggestions(state.query, corpus);
            const didYouMeanHtml = didYouMean.length > 0
                ? `<div class="search-did-you-mean">
                        <span>Did you mean:</span>
                        ${didYouMean.map((term) => `<button type="button" class="search-dym-link" data-suggest-query="${escapeHtml(term)}">${escapeHtml(term)}</button>`).join(', ')}
                   </div>`
                : '';

            const chipsHtml = POPULAR_SEARCH_CHIPS.map((chip) =>
                `<button type="button" class="search-chip-btn" data-suggest-query="${escapeHtml(chip)}">${escapeHtml(chip)}</button>`
            ).join('');

            resultsEl.innerHTML = `
                <div class="search-empty-card">
                    <div class="search-empty-icon"><i class="ri-file-search-line"></i></div>
                    <h2>No results found for &ldquo;${escapeHtml(state.query)}&rdquo;</h2>
                    <p>We searched across all resources, cyber safety guides, support centers, and blog posts, and didn&rsquo;t find a match.</p>
                    ${didYouMeanHtml}
                    <div class="search-next-tips">
                        <h3>What to try next:</h3>
                        <ul>
                            <li><i class="ri-check-line"></i> Check the spelling of your search terms or try fewer words.</li>
                            <li><i class="ri-check-line"></i> Try a broader topic such as <strong>Legal Aid</strong>, <strong>Counselling</strong>, <strong>NCII</strong>, or a district name like <strong>Hyderabad</strong>.</li>
                            <li><i class="ri-check-line"></i> Need urgent assistance? Call the toll-free Women&rsquo;s Helpline at <a href="tel:181"><strong>181</strong></a> or Police at <a href="tel:112"><strong>112</strong></a>.</li>
                        </ul>
                    </div>
                    <div class="search-empty-suggestions">
                        <h3>Suggested Searches</h3>
                        <div class="search-chips-wrap" style="justify-content: center;">${chipsHtml}</div>
                    </div>
                    <div class="search-quick-browse">
                        <a href="resources.html" class="search-browse-link"><i class="ri-heart-handshake-line"></i> Browse Resource Center</a>
                        <a href="cyber-gbv.html" class="search-browse-link"><i class="ri-shield-keyhole-line"></i> Cyber GBV Hub</a>
                        <a href="index.html#find-center" class="search-browse-link"><i class="ri-map-pin-2-line"></i> Find a Center by PIN</a>
                    </div>
                </div>
            `;
            bindEmptyStateTriggers();
        };

        const bindEmptyStateTriggers = () => {
            resultsEl.querySelectorAll('[data-suggest-query]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const q = btn.getAttribute('data-suggest-query') || '';
                    inputEl.value = q;
                    clearBtn.hidden = !q;
                    state.query = q;
                    state.type = 'all';
                    state.page = 1;
                    writeUrlState();
                    executeAndRender();
                });
            });
        };

        const renderPagination = (totalItems, totalPages) => {
            if (totalPages <= 1) {
                paginationEl.innerHTML = '';
                return;
            }

            const pages = [];
            pages.push(1);
            const left = Math.max(2, state.page - 1);
            const right = Math.min(totalPages - 1, state.page + 1);

            if (left > 2) pages.push('...');
            for (let i = left; i <= right; i++) pages.push(i);
            if (right < totalPages - 1) pages.push('...');
            if (totalPages > 1) pages.push(totalPages);

            let html = `
                <button type="button" class="pagination-btn pagination-nav" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''} aria-label="Previous page">
                    <i class="ri-arrow-left-s-line"></i>
                    <span>Prev</span>
                </button>
            `;

            pages.forEach((p) => {
                if (p === '...') {
                    html += `<span class="pagination-ellipsis" aria-hidden="true">&hellip;</span>`;
                } else {
                    const isCurrent = p === state.page;
                    html += `
                        <button type="button" class="pagination-btn ${isCurrent ? 'active' : ''}" data-page="${p}" ${isCurrent ? 'aria-current="page"' : ''}>
                            ${p}
                        </button>
                    `;
                }
            });

            html += `
                <button type="button" class="pagination-btn pagination-nav" data-page="${state.page + 1}" ${state.page >= totalPages ? 'disabled' : ''} aria-label="Next page">
                    <span>Next</span>
                    <i class="ri-arrow-right-s-line"></i>
                </button>
            `;

            paginationEl.innerHTML = html;

            paginationEl.querySelectorAll('[data-page]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    if (btn.disabled) return;
                    const targetPage = parseInt(btn.getAttribute('data-page'), 10);
                    if (!Number.isFinite(targetPage) || targetPage < 1 || targetPage > totalPages) return;
                    state.page = targetPage;
                    writeUrlState();
                    executeAndRender();
                    const toolbar = document.getElementById('searchToolbar');
                    if (toolbar) toolbar.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            });
        };

        const renderResults = (corpus) => {
            const allMatches = state.query ? searchCorpus(state.query, corpus) : [];
            renderFilters(allMatches);

            const filteredMatches = state.type === 'all'
                ? allMatches
                : allMatches.filter((m) => m.item.type === state.type);

            if (!state.query || filteredMatches.length === 0) {
                if (state.query && filteredMatches.length === 0) {
                    statusEl.innerHTML = `0 results found for <strong>&ldquo;${escapeHtml(state.query)}&rdquo;</strong>`;
                }
                renderEmptyState(corpus, allMatches);
                return;
            }

            const total = filteredMatches.length;
            const totalPages = Math.max(1, Math.ceil(total / RESULTS_PER_PAGE));
            if (state.page > totalPages) state.page = totalPages;

            const startIdx = (state.page - 1) * RESULTS_PER_PAGE;
            const endIdx = Math.min(total, startIdx + RESULTS_PER_PAGE);
            const pageItems = filteredMatches.slice(startIdx, endIdx);

            statusEl.innerHTML = `Showing <strong>${startIdx + 1}&ndash;${endIdx}</strong> of <strong>${total}</strong> result${total === 1 ? '' : 's'} for <strong>&ldquo;${escapeHtml(state.query)}&rdquo;</strong>`;

            const cardsHtml = pageItems.map(({ item, bestSection, matchedSections }) => {
                const targetUrl = resolveUrl((bestSection && bestSection.url) || item.url);
                const snippet = buildSnippet(item, bestSection, state.query);
                const highlightedTitle = highlightText(item.title, state.query);
                const highlightedSnippet = highlightText(snippet, state.query);

                const metaBadges = [];
                if (item.badgeMeta) metaBadges.push(`<span class="result-meta-chip"><i class="ri-bookmark-line"></i> ${escapeHtml(item.badgeMeta)}</span>`);
                if (item.district) metaBadges.push(`<span class="result-meta-chip"><i class="ri-map-pin-line"></i> ${escapeHtml(item.district)}</span>`);
                if (item.date) {
                    const formattedDate = new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                    metaBadges.push(`<span class="result-meta-chip"><i class="ri-calendar-line"></i> ${escapeHtml(formattedDate)}</span>`);
                }

                const deepSections = (matchedSections || []).filter((sec) => sec.url && sec.url !== item.url);
                const sectionPillsHtml = deepSections.length > 0
                    ? `<div class="result-sections-row">
                            <span class="result-sections-label">Jump to section:</span>
                            ${deepSections.map((sec) => `<a href="${escapeHtml(resolveUrl(sec.url))}" class="result-section-jump"><i class="ri-arrow-right-up-line"></i>${highlightText(sec.title, state.query)}</a>`).join('')}
                       </div>`
                    : '';

                const cleanDisplayPath = targetUrl.replace(/^\//, '').replace(/\?.*$/, '');

                return `
                    <article class="search-result-card">
                        <div class="result-card-top">
                            <div class="result-badges-row">
                                <span class="result-type-badge ${getBadgeStyleClass(item.type)}">${escapeHtml(item.typeLabel)}</span>
                                ${metaBadges.join('')}
                            </div>
                            <span class="result-path-label">${escapeHtml(cleanDisplayPath)}</span>
                        </div>
                        <h3 class="result-card-title">
                            <a href="${escapeHtml(targetUrl)}">${highlightedTitle}</a>
                        </h3>
                        <p class="result-card-snippet">${highlightedSnippet}</p>
                        ${sectionPillsHtml}
                        <div class="result-card-footer">
                            <a href="${escapeHtml(targetUrl)}" class="result-open-link">
                                View Page <i class="ri-arrow-right-line"></i>
                            </a>
                        </div>
                    </article>
                `;
            }).join('');

            resultsEl.innerHTML = cardsHtml;
            renderPagination(total, totalPages);
        };

        const executeAndRender = async () => {
            if (state.query && (!cachedCorpus)) {
                resultsEl.innerHTML = `
                    <div class="search-loading-card">
                        <i class="ri-loader-4-line ri-spin"></i>
                        <p>Searching across resources, cyber safety guides, and blog posts...</p>
                    </div>
                `;
            }
            const corpus = await loadSearchCorpus();
            renderResults(corpus);
        };

        // Initial load from URL
        readUrlState();
        inputEl.value = state.query;
        clearBtn.hidden = !state.query;
        writeUrlState(true);
        executeAndRender();

        // Form submission & autocomplete on search.html
        let debounceTimer = null;
        const submitPageSearch = (val) => {
            const trimmed = String(val || '').trim();
            acList.hidden = true;
            inputEl.value = trimmed;
            clearBtn.hidden = !trimmed;
            state.query = trimmed;
            state.page = 1;
            writeUrlState();
            executeAndRender();
        };

        const resetAcIdx = bindAutocompleteKeyboard(inputEl, acList, submitPageSearch);

        formEl.addEventListener('submit', (e) => {
            e.preventDefault();
            submitPageSearch(inputEl.value);
        });

        clearBtn.addEventListener('click', () => {
            inputEl.value = '';
            clearBtn.hidden = true;
            acList.hidden = true;
            resetAcIdx();
            inputEl.focus();
        });

        inputEl.addEventListener('input', () => {
            const val = inputEl.value;
            clearBtn.hidden = val.length === 0;
            resetAcIdx();
            clearTimeout(debounceTimer);
            if (!val.trim()) {
                acList.hidden = true;
                return;
            }
            debounceTimer = setTimeout(async () => {
                const corpus = await loadSearchCorpus();
                const acData = getAutocompleteData(val, corpus);
                renderAutocompleteDropdown(acList, val, acData, submitPageSearch);
            }, 80);
        });

        document.addEventListener('click', (e) => {
            if (!formEl.contains(e.target)) {
                acList.hidden = true;
            }
        });

        window.addEventListener('popstate', () => {
            readUrlState();
            inputEl.value = state.query;
            clearBtn.hidden = !state.query;
            executeAndRender();
        });

        window.addEventListener('sakhi:executeSearch', (e) => {
            const detail = e.detail || {};
            state.query = (detail.query || '').trim();
            state.type = detail.type || 'all';
            state.page = detail.page || 1;
            inputEl.value = state.query;
            clearBtn.hidden = !state.query;
            writeUrlState();
            executeAndRender();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initGlobalSearchModal();
        initSearchResultsPage();
    });
})();
