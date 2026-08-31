"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sortBySearchRank } from "@/lib/searchRanking";

export function SearchableSelect({
  value,
  onValueChange,
  placeholder = "Select an option",
  options = [],
  className = "",
  disabled = false,
  searchPlaceholder = "Search...",
  getOptionLabel = (option) => option.label || option.name || option,
  getOptionValue = (option) => option.value || option.id || option,
  getOptionSearchText = (option) => getOptionLabel(option),
  emptyText = "No options found",
  allOptionText = "All",
  showAllOption = true,
  triggerClassName = "",
  selectedClassName = "bg-blue-50 text-blue-600 font-medium",
  onSearchChange,
  onDeleteOption,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter options based on search term, ranking closest matches first.
  const filteredOptions = searchTerm.trim()
    ? sortBySearchRank(
        options,
        searchTerm,
        (option) => getOptionSearchText(option),
        (option) => [
          getOptionLabel(option),
          getOptionValue(option),
          option.madarsaId,
          option.madrasaId,
          option.mid,
        ],
      )
    : options;

  // Get display value
  const getDisplayValue = () => {
    if (value === "all" && showAllOption) return allOptionText;
    if (!value) return placeholder;

    const selectedOption = options.find(
      (option) => getOptionValue(option) === value,
    );
    return selectedOption ? getOptionLabel(selectedOption) : placeholder;
  };

  const handleOptionSelect = (optionValue) => {
    onValueChange(optionValue);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "w-full justify-between font-normal",
          triggerClassName,
          disabled && "opacity-50 cursor-not-allowed",
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="truncate">{getDisplayValue()}</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </Button>

      {isOpen && (
        <Card className="absolute z-50 mt-1 w-full bg-white border shadow-lg">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                ref={inputRef}
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (onSearchChange) onSearchChange(e.target.value);
                }}
                className="pl-8 pr-8 h-10"
              />
              {searchTerm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {showAllOption && (
              <div
                className={cn(
                  "px-3 py-2 text-sm cursor-pointer hover:bg-gray-100",
                  value === "all" && selectedClassName,
                )}
                onClick={() => handleOptionSelect("all")}
              >
                {allOptionText}
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">{emptyText}</div>
            ) : (
              filteredOptions.map((option, index) => {
                const optionValue = getOptionValue(option);
                const isSelected = value === optionValue;

                return (
                  <div
                    key={`${optionValue}-${index}`}
                    className={cn(
                      "px-3 py-2 text-sm cursor-pointer hover:bg-gray-100",
                      isSelected && selectedClassName,
                    )}
                    onClick={() => handleOptionSelect(optionValue)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{getOptionLabel(option)}</div>
                        {option.madarsaId && (
                          <div className="text-xs font-mono mt-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 font-medium">
                              {(() => {
                                const raw = option.madarsaId || "";
                                const numeric = raw.replace(/^[a-zA-Z]+-/i, "");
                                return /^\d+$/.test(numeric) ? `MID-${numeric}` : raw.toUpperCase();
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                      {onDeleteOption && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteOption(option);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
