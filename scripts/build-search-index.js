const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'search-index.json');
const POSTS_FILE = path.join(ROOT_DIR, 'posts.json');

/**
 * Decode common HTML entities into plain UTF-8 text.
 */
function decodeHtmlEntities(str) {
    if (!str) return '';
    const named = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&nbsp;': ' ',
        '&mdash;': '—',
        '&ndash;': '–',
        '&rsquo;': '’',
        '&lsquo;': '‘',
        '&rdquo;': '”',
        '&ldquo;': '“',
        '&rarr;': '→',
        '&times;': '×',
        '&copy;': '©'
    };
    return str
        .replace(/&(amp|lt|gt|quot|apos|nbsp|mdash|ndash|rsquo|lsquo|rdquo|ldquo|rarr|times|copy|#39);/gi, (m) => named[m.toLowerCase()] || m)
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

/**
 * Strip comments, scripts, styles, and tags cleanly while preserving spacing between blocks.
 */
function htmlToText(html) {
    if (!html) return '';
    let cleaned = html
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ');

    cleaned = cleaned
        .replace(/<\/(p|div|li|h[1-6]|tr|td|th|section|article|header|blockquote|figcaption)>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');

    return decodeHtmlEntities(cleaned)
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,!?;:])/g, '$1')
        .trim();
}

/**
 * Extract the inner body content (everything between </nav> and <footer>).
 */
function extractMainHtml(rawHtml) {
    // Strip comments first so commented-out sections never bleed in
    const noComments = rawHtml.replace(/<!--[\s\S]*?-->/g, '');
    const navEnd = noComments.search(/<\/nav>/i);
    const footerStart = noComments.search(/<footer\b/i);
    if (navEnd !== -1 && footerStart !== -1 && footerStart > navEnd) {
        return noComments.slice(navEnd + 6, footerStart);
    }

    const mainMatch = noComments.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
        return mainMatch[1];
    }

    const bodyMatch = noComments.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : noComments;
}

/**
 * Extract balanced <div ...>...</div> block starting at an element with the given id.
 */
function extractDivById(html, id) {
    const startRegex = new RegExp(`<div\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
    const match = startRegex.exec(html);
    if (!match) return '';

    let depth = 0;
    const tagRegex = /<\/?div\b[^>]*>/gi;
    tagRegex.lastIndex = match.index;

    let tagMatch;
    while ((tagMatch = tagRegex.exec(html)) !== null) {
        if (tagMatch[0].startsWith('</')) {
            depth--;
            if (depth === 0) {
                return html.slice(match.index, tagRegex.lastIndex);
            }
        } else {
            depth++;
        }
    }
    return html.slice(match.index);
}

function extractMeta(rawHtml) {
    const titleMatch = rawHtml.match(/<title>([\s\S]*?)<\/title>/i);
    const descMatch = rawHtml.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)
        || rawHtml.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
    const keywordsMatch = rawHtml.match(/<meta\s+name=["']keywords["']\s+content=["']([\s\S]*?)["']/i)
        || rawHtml.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']keywords["']/i);

    return {
        pageTitle: titleMatch ? decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : '',
        description: descMatch ? decodeHtmlEntities(descMatch[1]).replace(/\s+/g, ' ').trim() : '',
        keywords: keywordsMatch ? decodeHtmlEntities(keywordsMatch[1]).replace(/\s+/g, ' ').trim() : ''
    };
}

function extractSectionsForPage(fileName, mainHtml) {
    const sections = [];

    if (fileName === 'resources.html') {
        const cardMeta = [
            { id: 'shelter', title: 'Sakhi One Stop Centers' },
            { id: 'legal', title: 'Legal Aid' },
            { id: 'medical', title: 'Medical Help' },
            { id: 'hiv', title: 'HIV support' },
            { id: 'counselling', title: 'Counselling' },
            { id: 'lgbtq', title: 'LGBTQIA+ Resources' },
            { id: 'govt-helpline', title: 'Government Helpline Numbers' }
        ];
        cardMeta.forEach(({ id, title }) => {
            const block = extractDivById(mainHtml, id);
            if (block) {
                sections.push({
                    title,
                    url: `resources.html#${id}`,
                    text: htmlToText(block)
                });
            }
        });
    } else if (fileName === 'cyber-resources.html') {
        const cyberSections = [
            { id: 'reporting-helplines', title: '1. Reporting & Emergency Helplines' },
            { id: 'legal-redressal', title: '2. Legal Rights, Laws & Grievance Redressal' },
            { id: 'cyber-awareness', title: '3. Cyber Awareness & Digital Empowerment' },
            { id: 'cyber-hygiene', title: '4. Practical Cyber Hygiene & Safety Handbooks' },
            { id: 'takedown-tools', title: '5. Automated Take-Down & Platform Safety Tools' },
            { id: 'institutional-toolkits', title: '6. Institutional Framework & International Toolkits' }
        ];
        cyberSections.forEach(({ id, title }) => {
            const block = extractDivById(mainHtml, id);
            if (block) {
                sections.push({
                    title,
                    url: `cyber-resources.html#${id}`,
                    text: htmlToText(block)
                });
            }
        });
    } else if (fileName === 'additional-resources.html') {
        const readingSections = [
            { id: 'global-guides', title: 'Global Directories & Educational Guides' },
            { id: 'research-reports', title: 'Investigative Journalism & Policy Research' }
        ];
        readingSections.forEach(({ id, title }) => {
            const block = extractDivById(mainHtml, id);
            if (block) {
                sections.push({
                    title,
                    url: `additional-resources.html#${id}`,
                    text: htmlToText(block)
                });
            }
        });
    } else if (fileName === 'NCII.html') {
        const tabs = [
            { id: 'tab-sop', title: 'Action Steps Checklist (12-Step NCII SOP)' },
            { id: 'tab-special', title: 'Special Situations (Minor/POCSO, Deepfakes, Sextortion)' },
            { id: 'tab-rights', title: 'Know Your Rights (IT Act & BNS 2023 Laws)' }
        ];
        tabs.forEach(({ id, title }) => {
            const block = extractDivById(mainHtml, id);
            if (block) {
                sections.push({
                    title,
                    url: `NCII.html?tab=${id}`,
                    text: htmlToText(block)
                });
            }
        });
    } else {
        // Generic heading-based section extraction for other pages
        const headingRegex = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
        const matches = [];
        let m;
        while ((m = headingRegex.exec(mainHtml)) !== null) {
            const text = htmlToText(m[2]);
            if (text && text.length > 2) {
                matches.push({ title: text, index: m.index });
            }
        }
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index;
            const end = i + 1 < matches.length ? matches[i + 1].index : mainHtml.length;
            const snippetText = htmlToText(mainHtml.slice(start, end));
            if (snippetText) {
                sections.push({
                    title: matches[i].title,
                    url: fileName,
                    text: snippetText
                });
            }
        }
    }

    return sections;
}

const STATIC_PAGES = [
    {
        file: 'resources.html',
        title: 'Resource Center — Verified GBV Support & Helplines',
        type: 'resources',
        typeLabel: 'Resources',
        extraKeywords: 'Sakhi One Stop Centers, Legal Aid, Medical Help, HIV support, Counselling, Counseling, LGBTQIA+, Government Helpline Numbers, shelter, rescue'
    },
    {
        file: 'additional-resources.html',
        title: 'Learn More — Global Guides & Research',
        type: 'resources',
        typeLabel: 'Learn More',
        extraKeywords: 'additional resources, findahelpline, domesticshelters, hercasematters, sexual abuse, sexual assault, Reporters Collective, Cold Shoulder, IndiaSpend, IWWAGE, Rapid Assessment of 181 Helpline and One Stop Centres, informative reads, research, international directories'
    },
    {
        file: 'cyber-gbv.html',
        title: 'Cyber Gender-Based Violence (GBV) Hub',
        type: 'cyber',
        typeLabel: 'Cyber Resources',
        extraKeywords: 'Cyber GBV, online harassment, NCII, intimate image leaks, StopNCII, 1930, cybercrime, SOP guide'
    },
    {
        file: 'NCII.html',
        title: 'Intimate Image Leaks (NCII) Response SOP Guide',
        type: 'cyber',
        typeLabel: 'Cyber Resources',
        extraKeywords: 'NCII SOP, StopNCII.org, Google search removal, cybercrime.gov.in, 1930, Zero FIR, Sakhi One Stop Centre, DLSA, NALSA 15100, Grievance Officer, GAC, NCW 14490, John Doe, counseling, counselling, POCSO 1098, deepfake, morphed images, sextortion, blackmail, IT Act 66E 67 67A 72, BNS 2023 77 78 79 356, IT Rules 2021'
    },
    {
        file: 'cyber-resources.html',
        title: 'Additional Cyber Safety Resources Directory',
        type: 'cyber',
        typeLabel: 'Cyber Resources',
        extraKeywords: 'NCRP, cybercrime.gov.in, 1930, 14490, 181, NALSA 15100, Report & Check Suspect, Grievance Appellate Committee, GAC, Her Legal Guide, IT Rules 2021, BNS 2023, CyberDost, Digital Shakti, e-SafeHER, Cyber Sakhi, Cyber Jaagrookta Diwas, ISEA, Stay Safe Online, CERT-In Mahila Suraksha, Emerging Threats, Digital Evidence Preservation, StopNCII.org, Take It Down, NCMEC, Google Search Content Removal, Safecity, SAHYOG, NCFL, TechSafety.org, eSafety Commissioner, CyberPeace Foundation'
    },
    {
        file: 'blog.html',
        title: 'Blog — Our Stories & Updates',
        type: 'blog',
        typeLabel: 'Blog',
        extraKeywords: 'articles, stories, impact, community updates, news'
    },
    {
        file: 'index.html',
        title: 'Home — Find Verified Help Near You',
        type: 'pages',
        typeLabel: 'Site Page',
        extraKeywords: 'Find a Center, PIN code search, Telangana, Hyderabad, Women Helpline 181, Police Helpline 112, Support Hub, Legal Aid, Sakhi One Stop Centers, Counselling'
    },
    {
        file: 'about.html',
        title: 'About Us — Sakhi 181 Mission & Leadership',
        type: 'pages',
        typeLabel: 'Site Page',
        extraKeywords: 'Samhita Vadrevu, mission, vision, core values, 96% awareness gap, confidentiality, verification, inclusivity'
    },
    {
        file: 'contact.html',
        title: 'Contact Us — Helpline & Registered Office',
        type: 'pages',
        typeLabel: 'Site Page',
        extraKeywords: 'contact, Banjara Hills, Hyderabad, Telangana, email, info@sakhi181.com, Dial 181, feedback, inquiry'
    },
    {
        file: 'donate.html',
        title: 'Support & Donate to Sakhi 181',
        type: 'pages',
        typeLabel: 'Site Page',
        extraKeywords: 'donate, bank transfer, NEFT, IMPS, UPI, HDFC, 80G tax exemption, FAQ, Sakhi181 Foundation'
    }
];

function buildSearchIndex() {
    const items = [];

    for (const page of STATIC_PAGES) {
        const filePath = path.join(ROOT_DIR, page.file);
        if (!fs.existsSync(filePath)) {
            console.warn(`Warning: ${page.file} not found, skipping.`);
            continue;
        }
        const rawHtml = fs.readFileSync(filePath, 'utf-8');
        const meta = extractMeta(rawHtml);
        const mainHtml = extractMainHtml(rawHtml);
        const text = htmlToText(mainHtml);
        const sections = extractSectionsForPage(page.file, mainHtml);

        items.push({
            id: `page-${page.file.replace('.html', '')}`,
            url: page.file,
            title: page.title,
            description: meta.description || text.slice(0, 220),
            type: page.type,
            typeLabel: page.typeLabel,
            keywords: [meta.keywords, page.extraKeywords].filter(Boolean).join(', '),
            sections,
            text
        });
    }

    // Merge blog posts from posts.json if available
    if (fs.existsSync(POSTS_FILE)) {
        try {
            const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
            posts.forEach((post) => {
                if (post.published === false) return;
                const plainContent = htmlToText(post.content || '');
                items.push({
                    id: `blog-${post.slug}`,
                    url: `blog-post.html?slug=${encodeURIComponent(post.slug)}`,
                    title: post.title,
                    description: post.excerpt || plainContent.slice(0, 220),
                    type: 'blog',
                    typeLabel: 'Blog Post',
                    date: post.date || '',
                    image: post.coverImage || '',
                    keywords: `${post.title}, blog, story, ${post.excerpt || ''}`,
                    sections: [],
                    text: plainContent
                });
            });
        } catch (err) {
            console.error('Error reading posts.json:', err);
        }
    }

    const payload = {
        generatedAt: new Date().toISOString(),
        items
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2));
    console.log(`Successfully built search index with ${items.length} entries -> search-index.json`);
}

buildSearchIndex();
