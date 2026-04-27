"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

const MONTHS_DE = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];
const DAYS_DE = ["Mo","Di","Mi","Do","Fr","Sa","So"];

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // European: week starts Monday. getDay() 0=Sun → offset 6, 1=Mon → 0, ...
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const grid: (Date | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  return grid;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface DatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, placeholder = "Datum wählen", className }: DatePickerProps) {
  const selected = value ? new Date(value + "T12:00:00") : null;
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [view, setView] = useState({
    year: selected?.getFullYear() ?? today.getFullYear(),
    month: selected?.getMonth() ?? today.getMonth(),
  });

  function prevMonth() {
    setView((v) =>
      v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 }
    );
  }
  function nextMonth() {
    setView((v) =>
      v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 }
    );
  }

  function selectDate(d: Date) {
    onChange(toYMD(d));
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  const grid = getMonthGrid(view.year, view.month);

  const label = selected
    ? selected.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o && selected) setView({ year: selected.getFullYear(), month: selected.getMonth() });
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors",
            "focus-visible:outline-none focus-visible:border-foreground/30",
            !label && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">{label ?? placeholder}</span>
          {label && (
            <span
              role="button"
              tabIndex={0}
              onClick={clear}
              onKeyDown={(e) => e.key === "Enter" && clear(e as unknown as React.MouseEvent)}
              className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <button
            type="button"
            onClick={prevMonth}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold select-none">
            {MONTHS_DE[view.month]} {view.year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="p-3 pb-2">
          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DAYS_DE.map((d) => (
              <div key={d} className="py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {grid.map((date, i) => {
              if (!date) return <div key={`pad-${i}`} className="h-8 w-8" />;
              const isSelected = selected ? isSameDay(date, selected) : false;
              const isToday = isSameDay(date, today);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => selectDate(date)}
                  className={cn(
                    "relative mx-auto flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isToday
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-accent"
                  )}
                >
                  {date.getDate()}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer: Heute / Leeren */}
        <div className="flex gap-1 border-t p-2">
          <button
            type="button"
            onClick={() => selectDate(today)}
            className="flex-1 rounded-md py-1.5 text-center text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            Heute
          </button>
          {label && (
            <button
              type="button"
              onClick={(e) => { clear(e); setOpen(false); }}
              className="flex-1 rounded-md py-1.5 text-center text-xs font-medium text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
            >
              Leeren
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
