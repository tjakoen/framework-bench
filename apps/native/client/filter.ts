// apps/native/client/filter.ts — the ONE client module. BATCH serves it transpiled on request
// (makeModuleServer), so a static-style page ships typed JS with no bundler and no build step. This is
// the whole native-first bet the bench measures: server-rendered HTML + this one small script.
//
// Client-safe: pure DOM, no imports (nothing server-only to leak). The list is already in the DOM,
// fully rendered; this only toggles card visibility — no route change, no refetch.

const q = document.getElementById("q") as HTMLInputElement | null;
const countEl = document.getElementById("count");
const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".chip"));
const cards = Array.from(document.querySelectorAll<HTMLElement>(".card"));

let activeTag: string | null = null;
let query = "";

function apply(): void {
  let shown = 0;
  for (const card of cards) {
    const haystack = `${card.dataset.title ?? ""} ${card.dataset.excerpt ?? ""}`.toLowerCase();
    const matchesQuery = query === "" || haystack.includes(query);
    const matchesTag = activeTag === null || card.dataset.tag === activeTag;
    const show = matchesQuery && matchesTag;
    card.hidden = !show;
    if (show) shown++;
  }
  if (countEl) {
    const bits = [`${shown} of ${cards.length} posts`];
    if (activeTag) bits.push(`tag: ${activeTag}`);
    if (query) bits.push(`“${query}”`);
    countEl.textContent = bits.join(" · ");
  }
}

q?.addEventListener("input", () => {
  query = q.value.trim().toLowerCase();
  apply();
});

for (const chip of chips) {
  chip.addEventListener("click", () => {
    const tag = chip.dataset.tag ?? null;
    activeTag = activeTag === tag ? null : tag;               // clicking the active chip clears it
    for (const c of chips) c.setAttribute("aria-pressed", String(c.dataset.tag === activeTag));
    apply();
  });
}

apply();
