# LLM Lab frontend

React and TypeScript app powered by Vite and Tailwind CSS, connected to the
backend server for LLM prompt generation.

## Getting started

1. Configure `GEMINI_API_KEY` in `../test/.env`.
2. Install the existing LLM helper's dependencies:

   ```sh
   cd ../test
   npm install
   ```

3. In a terminal, install and start the backend:

   ```sh
   cd ../backend
   npm install
   npm run dev
   ```

4. In another terminal, start the frontend:

   ```sh
   cd ../frontend
   npm install
   npm run dev
   ```

The frontend sends prompts to `POST /api/generate`; Vite proxies API requests to
the backend at `http://localhost:3001`. The backend calls the shared LLM helper
in `../test/index.js`, so the API key stays on the server.

Run `npm run build` and `npm run lint` here to build and check the frontend.
Run `npm run typecheck` in `../backend` to type-check the server.
