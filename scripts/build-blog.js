const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const postsDir = path.join(__dirname, '../posts');
const outputFile = path.join(__dirname, '../posts.json');

// Create posts directory if it doesn't exist
if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
}

const files = fs.readdirSync(postsDir);
const posts = [];

files.forEach(file => {
    if (file.endsWith('.md')) {
        const fileContent = fs.readFileSync(path.join(postsDir, file), 'utf-8');
        const { data, content } = matter(fileContent);
        
        if (data.published !== false) {
            const htmlContent = marked(content);
            posts.push({
                ...data,
                slug: data.slug || file.replace('.md', ''),
                content: htmlContent
            });
        }
    }
});

// Sort by date descending
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

fs.writeFileSync(outputFile, JSON.stringify(posts));
console.log(`Successfully built ${posts.length} blog posts.`);
