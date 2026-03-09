const SUGGESTIONS = Object.freeze([
  "Create a Todo App",
  "Create a Budget Tracker App",
  "Create a Login and Signup Page",
  "Develop a Task Management App",
  "Create a Fully Responsive Blog Platform",
  "Design a Minimal Note-Taking App",
  "Develop a Customizable Landing Page",
  "Develop a Recipe Sharing Platform",
  "Create a Fitness Tracking App",
  "Develop a Personal Finance Management Tool",
  "Create a Language Learning App",
  "Build a Virtual Event Platform",
  "Create a Music Streaming UI",
]);

const DEFAULT_FILES = Object.freeze({
  "/index.html": Object.freeze({
    code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Generated React + Vite application" />
    <title>Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>`,
  }),

  "/main.jsx": Object.freeze({
    code: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
  }),

  "/App.js": Object.freeze({
    code: `export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-3xl font-bold tracking-tight">React + Vite + Tailwind</h1>
        <p className="mt-3 text-slate-300">
          Your generated project is ready. Start building components and pages from here.
        </p>
      </section>
    </main>
  );
}`,
  }),

  "/index.css": Object.freeze({
    code: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}`,
  }),

  "/tailwind.config.cjs": Object.freeze({
    code: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./layouts/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-animate")],
};`,
  }),

  "/postcss.config.cjs": Object.freeze({
    code: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`,
  }),
});

const DEPENDENCIES = Object.freeze({
  react: "^18.2.0",
  "react-dom": "^18.2.0",
  postcss: "^8.4.49",
  tailwindcss: "^3.4.17",
  autoprefixer: "^10.4.20",
  "tailwind-merge": "^2.5.5",
  "tailwindcss-animate": "^1.0.7",
});

const OPTIONAL_DEPENDENCIES = Object.freeze({
  "lucide-react": "^0.468.0",
  "react-router-dom": "^7.1.1",
  "framer-motion": "^11.15.0",
});

export default Object.freeze({
  SUGGESTIONS,
  DEFAULT_FILES,
  DEPENDENCIES,
  OPTIONAL_DEPENDENCIES,
});
