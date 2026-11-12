import Link from "next/link";

export function Mark({ size = 44 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="75 75 928 928" aria-hidden="true">
      <rect x="75" y="75" width="928" height="928" fill="#FAB137" />
      <g fill="#000">
        <path id="pl-half" d="M459 249V829H352V349H325C292 349 276 378 276 418C276 458 296 484 332 484V586H298C214 586 168 515 168 418C168 320 214 249 298 249Z" />
        <rect x="485" y="249" width="108" height="580" />
        <use href="#pl-half" transform="translate(1077 0) scale(-1 1)" />
      </g>
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="lockup">
      <Mark />
      <span className="words">
        <span className="word">presumptuous</span>
        <span className="word">learning</span>
      </span>
    </Link>
  );
}
