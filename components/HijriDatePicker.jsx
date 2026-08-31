"use client";

import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HIJRI_WEEKDAYS = {
  "Al Ahad": 0,
  "Al Ithnayn": 1,
  "Al Thulatha": 2,
  "Al Arba'a": 3,
  "Al Khamis": 4,
  "Al Jumu'a": 5,
  "Al Sabt": 6,
};

const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani",
  "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
];

export default function HijriDatePicker({ value, onSelect, placeholder = "Select Islamic Date", minDate }) {
  const [open, setOpen] = useState(false);
  
  // Display text in the input
  const [displayText, setDisplayText] = useState("");

  // Current viewed month/year in the calendar
  const [currentHMonth, setCurrentHMonth] = useState(1);
  const [currentHYear, setCurrentHYear] = useState(1446);
  
  // Data for the current viewed month
  const [calendarDays, setCalendarDays] = useState([]);
  const [loading, setLoading] = useState(false);

  // Initialize today's Hijri date
  useEffect(() => {
    const fetchToday = async () => {
      try {
        const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        const res = await fetch(`https://api.aladhan.com/v1/gToH?date=${dateStr}`);
        const data = await res.json();
        if (data?.data?.hijri) {
          const h = data.data.hijri;
          if (!value) {
            setCurrentHMonth(h.month.number);
            setCurrentHYear(parseInt(h.year));
          }
        }
      } catch (err) {
        console.error("Failed to fetch today's hijri date", err);
      }
    };
    fetchToday();
  }, [value]);

  // If value (Gregorian YYYY-MM-DD) is provided, fetch its Hijri equivalent to set as display
  useEffect(() => {
    if (value) {
      const fetchHijriForValue = async () => {
        try {
          const [y, m, d] = value.split("-");
          const res = await fetch(`https://api.aladhan.com/v1/gToH?date=${d}-${m}-${y}`);
          const data = await res.json();
          if (data?.data?.hijri) {
            const h = data.data.hijri;
            setDisplayText(`${h.day} ${h.month.en} ${h.year}`);
            setCurrentHMonth(h.month.number);
            setCurrentHYear(parseInt(h.year));
          }
        } catch (err) {
          console.error("Failed to convert value to hijri", err);
        }
      };
      fetchHijriForValue();
    } else {
      setDisplayText("");
    }
  }, [value]);

  // Fetch calendar for viewed month/year
  useEffect(() => {
    if (!open) return;
    
    const fetchCalendar = async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://api.aladhan.com/v1/hToGCalendar/${currentHMonth}/${currentHYear}`);
        const data = await res.json();
        if (data?.data) {
          setCalendarDays(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch hijri calendar", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, [currentHMonth, currentHYear, open]);

  const handlePrevMonth = () => {
    if (currentHMonth === 1) {
      setCurrentHMonth(12);
      setCurrentHYear(prev => prev - 1);
    } else {
      setCurrentHMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentHMonth === 12) {
      setCurrentHMonth(1);
      setCurrentHYear(prev => prev + 1);
    } else {
      setCurrentHMonth(prev => prev + 1);
    }
  };

  const handleDaySelect = (dayObj) => {
    // dayObj.gregorian.date is DD-MM-YYYY
    const [d, m, y] = dayObj.gregorian.date.split("-");
    const isoDate = `${y}-${m}-${d}`;
    
    // Optional minDate check
    if (minDate && new Date(isoDate) < new Date(minDate)) {
      return; // Invalid selection
    }
    
    const h = dayObj.hijri;
    const hText = `${h.day} ${h.month.en} ${h.year}`;
    
    setDisplayText(hText);
    onSelect(isoDate, hText);
    setOpen(false);
  };

  const getEmptyCells = () => {
    if (calendarDays.length === 0) return [];
    const firstDayStr = calendarDays[0].hijri.weekday.en;
    // fallback or match
    let weekdayIdx = HIJRI_WEEKDAYS[firstDayStr];
    if (weekdayIdx === undefined) {
      // Find matching string if exact match fails
      const entry = Object.entries(HIJRI_WEEKDAYS).find(([k]) => firstDayStr.includes(k) || k.includes(firstDayStr));
      weekdayIdx = entry ? entry[1] : 0;
    }
    return Array(weekdayIdx).fill(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal bg-white",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText || <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between space-x-2 pb-3">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-medium text-sm">
            {HIJRI_MONTHS[currentHMonth - 1]} {currentHYear}
          </div>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="h-[220px] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
              {WEEKDAYS.map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getEmptyCells().map((_, i) => (
                <div key={`empty-${i}`} className="h-8 w-8" />
              ))}
              {calendarDays.map((day, i) => {
                const [gd, gm, gy] = day.gregorian.date.split("-");
                const isoDate = `${gy}-${gm}-${gd}`;
                const isPast = minDate ? new Date(isoDate) < new Date(minDate) : false;
                const isSelected = value === isoDate;
                
                return (
                  <Button
                    key={i}
                    variant={isSelected ? "default" : "ghost"}
                    className={cn(
                      "h-8 w-8 p-0 font-normal text-sm",
                      isPast && "text-muted-foreground opacity-50 cursor-not-allowed hover:bg-transparent"
                    )}
                    onClick={() => !isPast && handleDaySelect(day)}
                  >
                    {day.hijri.day}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
