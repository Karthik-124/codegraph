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
      <body>{children}</body>
    </html>
  );
}
