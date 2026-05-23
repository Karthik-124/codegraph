import './globals.css';

export const metadata = {
  title: 'CodeGraph — Visual Codebase Explorer',
  description:
    'Paste a GitHub repo URL and get an interactive knowledge graph of every file, function, and class — then chat with the codebase using AI.',
  keywords: ['github', 'code graph', 'codebase explorer', 'AI', 'visualization'],
  openGraph: {
    title: 'CodeGraph',
    description: 'Explore any GitHub repo as an interactive knowledge graph.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Syne — geometric display face, used for headings */}
        {/* IBM Plex Sans — neutral, technical body text */}
        {/* DM Mono — monospaced labels and code tags */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
