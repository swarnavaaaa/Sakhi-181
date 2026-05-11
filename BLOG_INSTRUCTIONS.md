# Blog Management Instructions

This document explains how to add, edit, and manage blog posts on the Sakhi 181 website using GitHub.

## How the Blog Works
The blog is powered by Markdown (`.md`) files stored in the `posts/` folder. When you make changes to this folder and upload/commit them to GitHub, Vercel will automatically build the site and publish your new posts.

---

## 1. Adding a New Blog Post

1. Go to the `posts/` folder in your GitHub repository.
2. Click on **Add file** > **Create new file**.
3. Name your file with a URL-friendly name and a `.md` extension (e.g., `my-new-post.md`). This will become the URL of the post (e.g., `yoursite.com/blog/my-new-post`).
4. At the very top of the file, add the **Frontmatter**. This tells the site the title, date, and other details. It must be surrounded by `---`:

```markdown
---
title: "Your Post Title Here"
date: "2024-05-15"
excerpt: "A short description of what this post is about."
coverImage: "/images/posts/your-image.jpg"
published: true
---

# Your Heading Here

Start writing the content of your blog post here...
```

5. Write your blog post content below the frontmatter using standard Markdown formatting.
6. Scroll down and click **Commit changes...** to save the file.

---

## 2. Editing an Existing Post

1. Navigate to the `posts/` folder in GitHub.
2. Click on the `.md` file you want to edit.
3. Click the pencil icon (✏️) in the top right corner of the file view.
4. Make your changes to the text or frontmatter.
   - *Tip: If you want to temporarily hide a post, change `published: true` to `published: false` in the frontmatter.*
5. Click **Commit changes...** to save.

---

## 3. Uploading Images

1. Go to the `public/images/posts/` folder in your GitHub repository.
2. Click on **Add file** > **Upload files**.
3. Choose the image file from your computer (e.g., `event-photo.jpg`).
4. Click **Commit changes...**.
5. In your Markdown file's frontmatter, reference the image exactly like this:
   `coverImage: "/images/posts/event-photo.jpg"`
6. To use the image inside the post content, use:
   `![Image Description](/images/posts/event-photo.jpg)`

---

## Formatting Tips (Markdown)

- **Headings**: Use `#` for large headings, `##` for medium, and `###` for small.
- **Bold**: Use `**text**` to make it **bold**.
- **Italic**: Use `*text*` to make it *italic*.
- **Lists**: Use `-` or `*` for bullet points. Use numbers `1.` for numbered lists.
- **Links**: Use `[Link Text](https://example.com)`.

Once you commit your changes, give Vercel a minute or two to build the site, and your new content will be live!
