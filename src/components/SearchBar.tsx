import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeArabicText } from "@/utils/arabicUtils";
import { Search, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  onSearch: (term: string) => void;
  suggestions: string[];
  onSelectSuggestion?: (selectedName: string) => void;
}

const SearchBar = React.forwardRef<any, SearchBarProps>(
  ({ onSearch, suggestions, onSelectSuggestion }, ref) => {
    // Expose focusAndClear method via ref
    React.useImperativeHandle(ref, () => ({
      focusAndClear: () => {
        setSearchTerm("");
        setShowSuggestions(false);
        inputRef.current?.focus();
      },
    }));
    const [searchTerm, setSearchTerm] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>(
      []
    );
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionRef = useRef<HTMLDivElement>(null);

    // Update filtered suggestions when search term or suggestions change
    useEffect(() => {
      if (searchTerm) {
        const normalizedSearch = normalizeArabicText(searchTerm.toLowerCase());
        const filtered = suggestions
          .filter((suggestion) =>
            normalizeArabicText(suggestion.toLowerCase()).includes(
              normalizedSearch
            )
          )
          .slice(0, 5); // Limit to 5 suggestions
        setFilteredSuggestions(filtered);
        setHighlightedIndex(filtered.length > 0 ? 0 : -1);
      } else {
        setFilteredSuggestions([]);
        setHighlightedIndex(-1);
      }
    }, [searchTerm, suggestions]);

    // Handle document clicks to close suggestions
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          suggestionRef.current &&
          !suggestionRef.current.contains(event.target as Node) &&
          inputRef.current &&
          !inputRef.current.contains(event.target as Node)
        ) {
          setShowSuggestions(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    const handleSearch = () => {
      onSearch(searchTerm);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
      if (e.target.value) {
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
        onSearch("");
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (showSuggestions && filteredSuggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
        } else if (e.key === "Enter") {
          if (
            highlightedIndex >= 0 &&
            highlightedIndex < filteredSuggestions.length
          ) {
            handleSuggestionClick(filteredSuggestions[highlightedIndex]);
          } else {
            handleSearch();
          }
          setShowSuggestions(false);
        }
      } else if (e.key === "Enter") {
        handleSearch();
        setShowSuggestions(false);
      }
    };

    const handleSuggestionClick = (suggestion: string) => {
      setSearchTerm(suggestion);
      onSearch(suggestion);
      if (onSelectSuggestion) {
        onSelectSuggestion(suggestion);
      }
      setShowSuggestions(false);
    };

    const clearSearch = () => {
      setSearchTerm("");
      onSearch("");
      inputRef.current?.focus();
    };

    return (
      <div className="relative">
        <div className="flex">
          <div className="relative flex-grow">
            <Input
              ref={inputRef}
              type="text"
              placeholder="اكتب اسم الطالب للبحث..."
              value={searchTerm}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(searchTerm.length > 0)}
              className="pr-8 w-full"
              dir="rtl"
            />
            {searchTerm && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={clearSearch}
                type="button"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <Button type="button" onClick={handleSearch} className="ml-2">
            <Search size={18} />
          </Button>
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div
            ref={suggestionRef}
            className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`px-4 py-2 cursor-pointer text-right ${
                  highlightedIndex === index ? "bg-gray-100" : ""
                }`}
                onClick={() => handleSuggestionClick(suggestion)}
                dir="rtl"
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

export default SearchBar;
