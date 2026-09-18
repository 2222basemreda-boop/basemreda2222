import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string; sub?: string; keywords?: string };

export function SearchSelect({
  options, value, onChange, placeholder = "اختر…", emptyText = "لا توجد نتائج", allowClear = true, disabled,
}: {
  options: Option[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-12 w-full items-center gap-2 rounded-2xl border border-border bg-input px-4 text-start text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected ? (
              <>
                <span className="font-bold">{selected.label}</span>
                {selected.sub && <span className="text-muted-foreground"> · {selected.sub}</span>}
              </>
            ) : (
              placeholder
            )}
          </span>
          {selected && allowClear ? (
            <span
              role="button"
              aria-label="مسح"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="grid size-7 place-items-center rounded-lg hover:bg-brand/10"
            >
              <X className="size-4" />
            </span>
          ) : (
            <ChevronDown className="size-4 opacity-60" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="glass-strong w-[var(--radix-popover-trigger-width)] rounded-2xl border-0 p-0" align="start" dir="rtl">
        <Command className="bg-transparent">
          <CommandInput placeholder="ابحث…" className="h-11 text-base" />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.sub ?? ""} ${o.keywords ?? ""}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="min-h-11 rounded-xl"
                >
                  <Check className={cn("size-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="font-bold">{o.label}</span>
                  {o.sub && <span className="text-xs text-muted-foreground">{o.sub}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
