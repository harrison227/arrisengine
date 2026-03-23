import * as React from "react";
import { format } from "date-fns";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

interface DateTimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  hour: string;
  setHour: (hour: string) => void;
  minute: string;
  setMinute: (minute: string) => void;
  period: "AM" | "PM";
  setPeriod: (period: "AM" | "PM") => void;
}

// Sydney is UTC+10 (AEST) or UTC+11 (AEDT during daylight saving)
const getSydneyTimezoneLabel = (date: Date | undefined): string => {
  if (!date) return "AEDT";
  const month = date.getMonth();
  const isDST = month >= 9 || month <= 3;
  return isDST ? "AEDT" : "AEST";
};

const HOURS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MINUTES = ["00", "15", "30", "45"];

const QUICK_TIMES = [
  { label: "9 AM", hour: "09", minute: "00", period: "AM" as const },
  { label: "12 PM", hour: "12", minute: "00", period: "PM" as const },
  { label: "3 PM", hour: "03", minute: "00", period: "PM" as const },
  { label: "6 PM", hour: "06", minute: "00", period: "PM" as const },
];

function SelectField({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-11 rounded-md border border-input bg-background px-2 text-center focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function DateTimePicker({
  date,
  setDate,
  hour,
  setHour,
  minute,
  setMinute,
  period,
  setPeriod,
}: DateTimePickerProps) {
  const timezoneLabel = getSydneyTimezoneLabel(date);

  const handleQuickTime = (qt: (typeof QUICK_TIMES)[number]) => {
    setHour(qt.hour);
    setMinute(qt.minute);
    setPeriod(qt.period);
  };

  return (
    <div className="space-y-4">
      {/* Inline calendar (avoids Dialog+Popover ref loops) */}
      <div className="rounded-xl border border-border bg-card/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">
            {date ? format(date, "EEEE, MMM d, yyyy") : "Select a date"}
          </p>
          <span className="text-xs text-muted-foreground">Sydney</span>
        </div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="pointer-events-auto"
        />
      </div>

      {/* Time */}
      <div className="rounded-xl border border-border bg-card/60 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Scheduled time</span>
          </div>
          <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {timezoneLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <SelectField value={hour} onChange={setHour} className="w-20 font-mono text-lg">
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </SelectField>

          <span className="text-2xl font-light text-muted-foreground">:</span>

          <SelectField value={minute} onChange={setMinute} className="w-20 font-mono text-lg">
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectField>

          <SelectField value={period} onChange={(v) => setPeriod(v as "AM" | "PM")} className="w-20">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </SelectField>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Quick:</span>
          {QUICK_TIMES.map((qt) => {
            const active = hour === qt.hour && minute === qt.minute && period === qt.period;
            return (
              <Button
                key={qt.label}
                type="button"
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-7 px-2 text-xs", active && "text-foreground")}
                onClick={() => handleQuickTime(qt)}
              >
                {qt.label}
              </Button>
            );
          })}
        </div>
      </div>

      {date && (
        <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
          <p className="text-sm font-medium">
            📅 {format(date, "EEEE, MMMM d, yyyy")} at {hour}:{minute} {period} ({timezoneLabel})
          </p>
        </div>
      )}
    </div>
  );
}
