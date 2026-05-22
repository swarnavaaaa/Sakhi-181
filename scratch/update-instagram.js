const fs = require('fs');
const files = ['about.html', 'blog-post.html', 'blog.html', 'contact.html', 'index.html', 'resources.html'];

const IG_LINK = "https://www.instagram.com/sakhi181_foundation?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==";

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace <a href="#"> with <a href="LINK" target="_blank"> for instagram
  content = content.replace(
    /(<a href=\")[^\"]*(\" class=\"social-icon\"(?: aria-label=\"Instagram\")?>\s*<i class=\"ri-instagram-line\"><\/i>\s*<\/a>)/g,
    `$1${IG_LINK}" target="_blank$2`
  );
  
  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});
