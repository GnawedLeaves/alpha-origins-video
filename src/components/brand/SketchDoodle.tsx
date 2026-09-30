import { cn } from "@/lib/utils";

// Atmospheric monoline scribbles (a bone, paw prints, a loose squiggle) for hero backgrounds.
// Decorative only: low opacity, unfilled, drawn in the current text color so it works in both themes.
export function SketchDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      aria-hidden="true"
      className={cn("pointer-events-none select-none text-foreground opacity-25", className)}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* bone */}
        <path d="M58 70c-9-6-22 1-19 11 1 5 6 8 11 7-4 6 0 15 8 15 8 1 12-7 9-13l56-20c3 6 12 8 17 3 6-5 4-14-2-16 5-3 6-11 1-15-6-5-15-2-16 5l-57 21c-2-3-5-5-8-5z" />
        {/* paw prints */}
        <path d="M212 150c-10 1-17 11-13 19 3 6 12 5 18 6 6 0 12 3 15-3 4-9-8-23-20-22z" />
        <path d="M196 138c-3-5-9-5-10 0-1 5 3 10 7 9 4 0 5-5 3-9zM210 128c-1-6-7-8-10-3-2 4 0 10 5 10 4 0 6-3 5-7zM226 130c1-5-3-9-7-7-4 2-5 8-1 10 4 2 7 1 8-3zM238 143c2-4-1-8-5-7-4 1-6 7-3 9 3 2 7 1 8-2z" />
        <path d="M262 92c-6 0-10 6-8 11 2 4 7 3 11 4 4 0 7 2 9-2 2-6-5-13-12-13zM252 85c-2-3-5-3-6 0 0 3 2 6 4 5 3 0 3-3 2-5zM261 79c-1-4-4-5-6-2-1 3 0 6 3 6 2 0 4-2 3-4zM271 81c1-3-2-5-4-4-3 1-3 5-1 6 3 1 4 0 5-2z" />
        {/* loose squiggle */}
        <path d="M30 190c14-12 26 10 40-2s22-18 34-4 24 8 34-2 20-10 30 2" />
        <path d="M150 40c6-4 12 0 10 6-2 5-9 5-10 0" />
      </g>
    </svg>
  );
}
