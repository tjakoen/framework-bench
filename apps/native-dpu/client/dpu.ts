// apps/native-dpu/client/dpu.ts — the ONE measured module. Same user-facing filter as apps/native, but
// wired to Declarative Partial Updates: instead of toggling card visibility in the client, it asks the
// SERVER for a rendered fragment and lets the browser swap it in with a NATIVE HTML setter — no framework,
// no swap library (this is the whole "vs htmx without htmx's runtime" bet). Three tiers, feature-detected:
//
//   • streamHTMLUnsafe present (Chrome 148, experimental flag) → stream the fragment in as it arrives.
//   • setHTMLUnsafe present     (Firefox stable subset)        → set the fragment once fetched.
//   • neither                    (Safari / older)              → fall back to a pure client-side visibility
//                                                                toggle (apps/native's behavior) — zero
//                                                                round-trips, so `/` still filters offline.
//
// BATCH serves this transpiled on request (makeModuleServer), so it ships typed JS with no bundler/build.

const cards = document.getElementById("cards") as HTMLElement | null;
const countEl = document.getElementById("count");
const q = document.getElementById("q") as HTMLInputElement | null;
const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".chip"));

// The full set is server-rendered on load; remember the total for the count line even after a DPU swap
// replaces the list with a filtered subset.
const TOTAL = cards ? cards.querySelectorAll(":scope > li.card").length : 0;
// Snapshot the original cards so the no-DPU fallback can toggle visibility without a server round-trip.
const originalCards = cards ? Array.from(cards.querySelectorAll<HTMLElement>(":scope > li.card")) : [];

let activeTag: string | null = null;
let query = "";
let seq = 0; // guards against out-of-order fragment responses on fast typing

// setHTMLUnsafe() is already in lib.dom; the streaming setter isn't yet, so augment just that one.
type StreamingElement = HTMLElement & { streamHTMLUnsafe?(): WritableStream<string> };
const el = cards as StreamingElement | null;
const hasStream = typeof el?.streamHTMLUnsafe === "function";
const hasSet = typeof (cards as { setHTMLUnsafe?: unknown } | null)?.setHTMLUnsafe === "function";
const usesDpu = hasStream || hasSet;

function countText(shown: number): string {
  const bits = [`${shown} of ${TOTAL} posts`];
  if (activeTag) bits.push(`tag: ${activeTag}`);
  if (query) bits.push(`“${query}”`);
  return bits.join(" · ");
}
const setCount = (shown: number) => { if (countEl) countEl.textContent = countText(shown); };

/** DPU path: fetch the server-rendered fragment for the current filter and swap it in natively. */
async function applyViaDpu(): Promise<void> {
  if (!el) return;
  const mine = ++seq;
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (activeTag) params.set("tag", activeTag);
  const res = await fetch(`/fragment?${params.toString()}`, { headers: { "Accept": "text/html" } });
  if (mine !== seq) return; // a newer keystroke already fired; drop this stale response

  if (hasStream && res.body) {
    await res.body.pipeThrough(new TextDecoderStream()).pipeTo(el.streamHTMLUnsafe!());
  } else {
    el.setHTMLUnsafe(await res.text());
  }
  if (mine !== seq) return;
  setCount(el.querySelectorAll(":scope > li.card").length);
}

/** No-DPU floor: toggle the visibility of the already-rendered cards, exactly like apps/native. */
function applyViaToggle(): void {
  let shown = 0;
  for (const card of originalCards) {
    const haystack = `${card.dataset.title ?? ""} ${card.dataset.excerpt ?? ""}`.toLowerCase();
    const show = (query === "" || haystack.includes(query)) && (activeTag === null || card.dataset.tag === activeTag);
    card.hidden = !show;
    if (show) shown++;
  }
  setCount(shown);
}

function apply(): void {
  if (usesDpu) void applyViaDpu();
  else applyViaToggle();
}

q?.addEventListener("input", () => { query = q.value.trim().toLowerCase(); apply(); });

for (const chip of chips) {
  chip.addEventListener("click", () => {
    const tag = chip.dataset.tag ?? null;
    activeTag = activeTag === tag ? null : tag;                 // clicking the active chip clears it
    for (const c of chips) c.setAttribute("aria-pressed", String(c.dataset.tag === activeTag));
    apply();
  });
}

// Initial count only — leave the server-rendered full list untouched on load (no needless first fetch).
setCount(TOTAL);
