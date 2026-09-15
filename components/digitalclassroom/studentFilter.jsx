"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Search,
  Loader2,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * StudentFilters Component
 * Implements cascading filter logic for student data
 * Filter hierarchy (per MD doc): Mekhala (District) → District (Mekhala) → Madrasa → Gender/Class/Status
 * Note: UI labels are swapped - "District" uses mekhala collection, "Mekhala" uses district collection
 */
export default function StudentFilters({
  searchTerm = "",
  setSearchTerm,
  filterLevel = "all",
  setFilterLevel,
  filterGender = "all",
  setFilterGender,
  filterClass = "all",
  setFilterClass,
  filterStatus = "all",
  setFilterStatus,
  classes = [],
  loading = false,
  searchLoading = false,
}) {
  const filterTriggerClassName =
    "w-full border-black text-black focus-visible:border-black focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black";

  const filterContentClassName = "bg-white max-w-[300px]";

  const allowedClassesByLevel = {
    madrasa: new Set(["UKG", "Ukg", "ukg", "1", "2", "3"]),
    mekhala: new Set(["4", "6", "8", "9", "11"]),
    state: new Set(["5", "7", "10", "12"]),
  };

  const allowedSet = allowedClassesByLevel[filterLevel] || null;
  
  // Normalize UKG variants for set lookup
  const normalizeForSet = (c) => {
    const s = String(c).trim().toUpperCase();
    return s;
  };
  const visibleClasses = allowedSet
    ? classes.filter((c) => {
        const n = String(c).trim();
        const normalized = n.toUpperCase();
        return (
          allowedSet.has(n) ||
          allowedSet.has(normalized) ||
          (normalized === "UKG" &&
            (allowedSet.has("UKG") ||
              allowedSet.has("Ukg") ||
              allowedSet.has("ukg")))
        );
      })
    : classes;

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
  <CardContent className="p-4 md:p-5">
    <div className="space-y-4">

      {/* ================= SEARCH ================= */}
      <div>
        <div className="relative group">
          {searchLoading ? (
            <Loader2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-teal-600" />
          ) : (
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-teal-600" />
          )}

          <Input
            placeholder="Search name, email, phone, admission number or guardian..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="
              h-12
              rounded-xl
              border-slate-200
              bg-slate-50/70
              pl-11
              pr-4
              text-sm
              text-slate-900
              placeholder:text-slate-400
              transition-all
              hover:border-slate-300
              focus-visible:border-teal-500
              focus-visible:bg-white
              focus-visible:ring-2
              focus-visible:ring-teal-500/10
            "
          />
        </div>
      </div>

      {/* ================= FILTERS ================= */}
      <div className="rounded-xl border border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-teal-50/40 p-3 md:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">

          {/* Filter Label */}
          <div className="flex shrink-0 items-center gap-2 pr-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <SlidersHorizontal className="h-4 w-4" />
            </div>

            <div className="hidden xl:block">
              <p className="text-sm font-semibold text-slate-800">
                Filters
              </p>
              <p className="text-[11px] text-slate-400">
                Refine students
              </p>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3">

            {/* Gender */}
            <Select
              value={filterGender}
              onValueChange={setFilterGender}
            >
              <SelectTrigger
                className="
                  h-10
                  w-full
                  rounded-lg
                  border-slate-200
                  bg-white
                  text-sm
                  font-medium
                  text-slate-700
                  shadow-none
                  hover:border-teal-300
                  focus:ring-2
                  focus:ring-teal-500/10
                "
              >
                <SelectValue placeholder="Gender" />
              </SelectTrigger>

              <SelectContent className="rounded-xl border-slate-200">
                <SelectItem value="all">
                  All Genders
                </SelectItem>

                <SelectItem value="male">
                  Male
                </SelectItem>

                <SelectItem value="female">
                  Female
                </SelectItem>

                <SelectItem value="other">
                  Other
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Class */}
            <Select
              value={filterClass}
              onValueChange={setFilterClass}
            >
              <SelectTrigger
                className="
                  h-10
                  w-full
                  rounded-lg
                  border-slate-200
                  bg-white
                  text-sm
                  font-medium
                  text-slate-700
                  shadow-none
                  hover:border-teal-300
                  focus:ring-2
                  focus:ring-teal-500/10
                "
              >
                <SelectValue placeholder="Class" />
              </SelectTrigger>

              <SelectContent className="rounded-xl border-slate-200">
                <SelectItem value="all">
                  All Classes
                </SelectItem>

                {visibleClasses.map((classLevel) => {
                  const display =
                    String(classLevel)
                      .trim()
                      .toUpperCase() === "UKG"
                      ? "UKG"
                      : classLevel;

                  return (
                    <SelectItem
                      key={classLevel}
                      value={String(classLevel)}
                    >
                      {display}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Account Status */}
            {setFilterStatus && (
              <Select
                value={filterStatus}
                onValueChange={setFilterStatus}
              >
                <SelectTrigger
                  className="
                    h-10
                    w-full
                    rounded-lg
                    border-slate-200
                    bg-white
                    text-sm
                    font-medium
                    text-slate-700
                    shadow-none
                    hover:border-teal-300
                    focus:ring-2
                    focus:ring-teal-500/10
                  "
                >
                  <SelectValue placeholder="Account Status" />
                </SelectTrigger>

                <SelectContent className="rounded-xl border-slate-200">
                  <SelectItem value="all">
                    All Status
                  </SelectItem>

                  <SelectItem value="active">
                    Active
                  </SelectItem>

                  <SelectItem value="inactive">
                    Inactive
                  </SelectItem>

                  <SelectItem value="suspended">
                    Suspended
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

         
        </div>
      </div>
    </div>
  </CardContent>
</Card>
  );
}
