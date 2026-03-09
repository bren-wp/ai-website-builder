import Link from "next/link";
import { Code, Sparkles } from "lucide-react";

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center space-x-3"
            aria-label="Go to homepage"
          >
            <div className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 p-2">
              <Code className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">
              AI Powered Website Builder
            </h1>
          </Link>

          <div
            className="flex items-center space-x-2 rounded-full bg-green-500/10 px-3 py-1.5 text-sm font-medium text-green-400"
            role="status"
            aria-live="polite"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
