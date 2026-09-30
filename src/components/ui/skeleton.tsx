import { cn } from "@/lib/utils"

// Grey placeholder shape shown while a page loads. Decorative: screen readers get the
// surrounding `aria-busy` region and its label instead.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
