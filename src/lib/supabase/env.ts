// Literal `process.env.X` access on purpose: that is what lets Next inline
// these into the client bundle. A computed lookup would arrive as undefined
// in the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env.local and fill in the project's values.",
  );
}

export const SUPABASE_URL = url;
export const SUPABASE_KEY = key;
