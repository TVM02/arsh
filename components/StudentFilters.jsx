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

import { Search, Loader2 } from "lucide-react";

/**
 * StudentFilters Component
 * Implements cascading filter logic for student data
 * Filter hierarchy (per MD doc): Mekhala (District) → District (Mekhala) → Madrasa → Gender/Class/Status
 * Note: UI labels are swapped - "District" uses mekhala collection, "Mekhala" uses district collection
 */
export default function StudentFilters({
  searchTerm = "",
  setSearchTerm,
  filterMahal = "all",
  setFilterMahal,
  filterMekhala = "all",
  setFilterMekhala,
  filterDistrict = "all",
  setFilterDistrict,
  filterLevel = "all",
  setFilterLevel,
  filterGender = "all",
  setFilterGender,
  filterClass = "all",
  setFilterClass,
  filterStatus = "all",
  setFilterStatus,
  madarsas = [],
  mekhalas = [],
  districts = [],
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
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="space-y-4">
          {/* Search Filter - Full Width */}
          <div className="w-full">
            <div className="relative">
              {searchLoading ? (
                <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              )}
              <Input
                placeholder="Search by name, email, phone, admission #, guardian..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-black text-black focus-visible:border-black focus-visible:ring-black"
              />
            </div>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 ${districts && districts.length > 0 ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-3 md:gap-4`}>
            {/* District Filter - Level 1 (uses mekhalas collection) */}
            <div className="w-full">
                <SearchableSelect
                  value={filterDistrict}
                  onValueChange={setFilterDistrict}
                  placeholder="Filter by District"
                  searchPlaceholder="Search District..."
                  options={mekhalas}
                  getOptionLabel={(district) => district.name}
                  getOptionValue={(district) => district.id}
                  getOptionSearchText={(district) =>
                    `${district.name} ${district.id || ""}`
                  }
                  allOptionText="All Districts"
                  emptyText="No District found"
                  triggerClassName={filterTriggerClassName}
                  selectedClassName="bg-teal-50 text-teal-700 font-medium"
                />
            </div>

            {/* Mekhala Filter - Level 2 (uses districts collection) */}
            {districts && districts.length > 0 && setFilterMekhala && (
              <div className="w-full">
                  <SearchableSelect
                    value={filterMekhala}
                    onValueChange={setFilterMekhala}
                    placeholder="Filter by Mekhala"
                    searchPlaceholder="Search Mekhala..."
                    options={districts}
                    getOptionLabel={(mekhala) => mekhala.name}
                    getOptionValue={(mekhala) => mekhala.id}
                    getOptionSearchText={(mekhala) =>
                      `${mekhala.name} ${mekhala.id || ""}`
                    }
                    allOptionText="All Mekhalas"
                    emptyText="No Mekhala found"
                    triggerClassName={filterTriggerClassName}
                    selectedClassName="bg-teal-50 text-teal-700 font-medium"
                  />
              </div>
            )}

            {/* Scope Filter */}
            <div className="w-full">
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger className={filterTriggerClassName}>
                    <SelectValue placeholder="Filter Scope" />
                  </SelectTrigger>
                  <SelectContent className={filterContentClassName}>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="madrasa">Madrasa</SelectItem>
                    <SelectItem value="mekhala">Mekhala</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                  </SelectContent>
                </Select>
            </div>

            {/* Madrasa Filter - Level 3 (Filtered by parent pages based on District + Mekhala) */}
            <div className="w-full">
                <SearchableSelect
                  value={filterMahal}
                  onValueChange={setFilterMahal}
                  placeholder="Filter by Madrasa"
                  searchPlaceholder="Search madrasas..."
                  options={madarsas}
                  getOptionLabel={(madarsa) => `${madarsa.name}`}
                  getOptionValue={(madarsa) => madarsa.madarsaId || madarsa.id}
                  getOptionSearchText={(madarsa) =>
                    `${madarsa.name} ${madarsa.madarsaId || ""}`
                  }
                  allOptionText="All Madrasas"
                  emptyText="No madrasas found"
                  triggerClassName={filterTriggerClassName}
                  selectedClassName="bg-teal-50 text-teal-700 font-medium"
                />
            </div>

            {/* Gender Filter - Independent (can be used with any combination) */}
            <div className="w-full">
                <Select value={filterGender} onValueChange={setFilterGender}>
                  <SelectTrigger className={filterTriggerClassName}>
                    <SelectValue placeholder="Filter by Gender" />
                  </SelectTrigger>
                  <SelectContent className={filterContentClassName}>
                    <SelectItem value="all">All Genders</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
            </div>

            {/* Class Filter - Independent (can be used with any combination) */}
            <div className="w-full">
                <Select value={filterClass} onValueChange={setFilterClass}>
                  <SelectTrigger className={filterTriggerClassName}>
                    <SelectValue placeholder="Filter by Class" />
                  </SelectTrigger>
                  <SelectContent className={filterContentClassName}>
                    <SelectItem value="all">All Classes</SelectItem>
                    {visibleClasses.map((classLevel) => {
                      const display =
                        String(classLevel).trim().toUpperCase() === "UKG"
                          ? "UKG"
                          : classLevel;
                      return (
                        <SelectItem key={classLevel} value={String(classLevel)}>
                          {display}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
            </div>

            {/* Status Filter - Independent (can be used with any combination) */}
            {setFilterStatus && (
              <div className="w-full">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className={filterTriggerClassName}>
                      <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent className={filterContentClassName}>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
