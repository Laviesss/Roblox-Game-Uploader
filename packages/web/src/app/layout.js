import './globals.css';

export const metadata = {
  title: 'Roblox Publishing Platform',
  description: 'Automated Roblox publishing platform',
};

import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
        <nav className="bg-gray-800 text-white p-4">
          <div className="container mx-auto flex justify-between">
            <span className="font-bold">RGU Platform</span>
            <div>
              <a href="/" className="px-4">Dashboard</a>
              <a href="/login" className="px-4">Login</a>
            </div>
          </div>
        </nav>
        <main className="container mx-auto p-4">
          {children}
        </main>
        </Providers>
      </body>
    </html>
  );
}
