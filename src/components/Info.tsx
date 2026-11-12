"use client";
import { useEffect, useId, useRef, useState } from "react";

/** A small "i" button that opens a short explanation. Click or tap to open; Escape or a click elsewhere closes it. */
export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    // Fixed to the viewport so scrolling table wrappers can't clip it; kept on screen.
    const place = () => {
      const b = ref.current?.getBoundingClientRect();
      if (!b) return;
      const w = Math.min(320, window.innerWidth - 32);
      const up = b.bottom + 240 > window.innerHeight && b.top > 240; // open upwards near the bottom of the screen
      setPos({ up, top: up ? b.top - 8 : b.bottom + 8, left: Math.max(16, Math.min(b.left - 10, window.innerWidth - w - 16)) });
    };
    place();
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true);
    };
  }, [open]);
  return (
    <span className="info" ref={ref}>
      <button type="button" className="info-btn" aria-label={`About ${label}`} aria-expanded={open} aria-controls={id}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}>i</button>
      {open && pos && <span className="info-pop" id={id} role="note" style={{ top: pos.top, left: pos.left, transform: pos.up ? "translateY(-100%)" : undefined }}><b>{label}</b>{children}</span>}
    </span>
  );
}
