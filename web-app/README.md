# School SMIS Web App

The frontend for the School Management Information System. It is a React 19 application powered by Vite and styled with Tailwind CSS.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Setup

From this directory:

```bash
npm install
npm run dev
```

Vite will print the local development URL, normally `http://localhost:5173`.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## Frontend Foundation

- React Router DOM is initialized with `BrowserRouter` in `src/main.jsx`.
- TanStack Query is initialized with a shared `QueryClient` for server state and API caching.
- React Compiler is enabled through `@vitejs/plugin-react` for React 19 builds.
- Zod and React Hook Form provide schema-based form validation.
- Quill provides rich-text editing capabilities.
- DOMPurify should be used before rendering HTML supplied by users or external APIs.
- Tailwind CSS is loaded from `src/index.css`.

Add application routes in `src/App.jsx` using `Routes`, `Route`, and related React Router components.

## Environment Variables

Vite exposes only variables prefixed with `VITE_` to browser code. Create a local `.env` file when frontend configuration is needed:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

Do not place passwords, private keys, database credentials, or other secrets in frontend environment variables. They are included in the browser bundle.

## Project Structure

```text
src/
	api/           API clients and request helpers
	assets/        Static application assets
	components/    Shared React components
		layout/      Shared page layouts
		ui/           Reusable inputs, buttons, and messages
	features/Auth/ Authentication pages and schemas
	App.jsx        Application routes and layout
	main.jsx       Application providers and entry point
	index.css      Global styles and Tailwind entry point
```

## Production Checks

Run both checks before opening a pull request:

```bash
npm run lint
npm run build
```
