# Ziggy AI ?

A fast, friendly AI chat buddy. Ask anything, in any language. English is the default.

**Live demo:** https://ziggy-ai-pi.vercel.app

## Features

- Streaming replies, word by word
- Colorful Markdown: tables, lists, headings and code blocks
- Multiple saved chats with a sidebar
- Dark and light theme
- Voice input (works in Chrome and Edge)
- Stop and Copy buttons
- Basic rate limit to protect the free quota

## Tech stack

- Next.js (App Router) and TypeScript
- Tailwind CSS
- react-markdown and remark-gfm
- Groq API
- Hosted on Vercel

## Run it locally

    git clone https://github.com/pubgfunnybro-lang/Ziggy-AI.git
    cd Ziggy-AI
    npm install

Create a file named .env.local in the project root and add your key:

    GROQ_API_KEY=your_key_here

Then start the dev server:

    npm run dev

Open http://localhost:3000

## Deploy

Push the repo to GitHub, import it on Vercel, and add GROQ_API_KEY under Settings > Environment Variables. Redeploy after adding it.

## Notes

- Chats are saved in the browser (localStorage), so they do not sync between devices.
- Never commit your .env.local file or share your API key.
