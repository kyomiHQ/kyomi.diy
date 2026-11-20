import type { ComponentProps } from "react";
import { ChevronDownIcon } from "../icons/blode";
import { cn } from "../lib/utils";

type NativeSelectProps = Omit<ComponentProps<"select">, "multiple" | "size"> & {
  size?: "default" | "xl";
};

export function NativeSelect({ className, size = "default", ...props }: NativeSelectProps) {
  return (
    <span className={cn("relative inline-flex min-w-0", className)}>
      <select
        {...props}
        data-slot="native-select"
        className={cn(
          "w-full min-w-0 appearance-none truncate rounded-lg border border-input bg-background ps-3 pe-8 text-base text-foreground outline-none transition-shadow focus-visible:border-ring focus-visible:ring-(length:--field-ring-width) focus-visible:ring-ring/24 aria-invalid:border-destructive/64 aria-invalid:focus-visible:ring-destructive/16 disabled:opacity-(--opacity-disabled) motion-reduce:transition-none sm:text-sm dark:bg-input/32 forced-colors:appearance-auto forced-colors:pe-3 forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid",
          size === "xl" ? "h-(--control-xl)" : "h-(--control-md) sm:h-(--control-sm)",
        )}
      />
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-[calc(50%+var(--stroke-width)/2)] text-muted-foreground forced-colors:hidden [&_path]:[stroke-width:var(--icon-stroke)]"
      />
    </span>
  );
}
