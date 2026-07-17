"use client";
// apps/next/app/Filter.tsx — the ONE client component. This is Next's idiomatic answer to
// apps/native/client/filter.ts: instead of a hand-served transpiled module, it ships as part of the
// React client bundle and runs after hydration. Deliberately DOM-manipulation, not React state: the
// server component (app/page.tsx) renders the full static card list — byte-identical markup to native —
// and this component only queries it by id/class and toggles visibility, exactly like native does. That
// keeps initial HTML identical across targets; only the delivery mechanism (React + hydration runtime)
// differs, which is the honest cost this target measures.
import { useEffect } from "react";

export default function Filter(): null {
  useEffect(() => {
    const q = document.getElementById("q") as HTMLInputElement | null;
    const countEl = document.getElementById("count");
    const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".chip"));
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".card"));
    const form = document.querySelector<HTMLFormElement>(".filter");

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

    const onInput = () => {
      if (!q) return;
      query = q.value.trim().toLowerCase();
      apply();
    };
    q?.addEventListener("input", onInput);

    const chipCleanups: Array<() => void> = [];
    for (const chip of chips) {
      const onClick = () => {
        const tag = chip.dataset.tag ?? null;
        activeTag = activeTag === tag ? null : tag; // clicking the active chip clears it
        for (const c of chips) c.setAttribute("aria-pressed", String(c.dataset.tag === activeTag));
        apply();
      };
      chip.addEventListener("click", onClick);
      chipCleanups.push(() => chip.removeEventListener("click", onClick));
    }

    // Native prevents the search form's default submit via an inline `onsubmit="return false"` (the
    // #q input has no `name`, so a real submit would just reload "/" and drop the typed query). React
    // server components can't hold event-handler props, so the client component does the same job here.
    const onSubmit = (e: Event) => e.preventDefault();
    form?.addEventListener("submit", onSubmit);

    apply(); // apply once on mount, matching native's unconditional call at module load

    return () => {
      q?.removeEventListener("input", onInput);
      chipCleanups.forEach((cleanup) => cleanup());
      form?.removeEventListener("submit", onSubmit);
    };
  }, []);

  return null;
}
