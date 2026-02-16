import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Settings2, Search } from "lucide-react";
import { countryData } from "@/components/advertisers/countryData";

interface AffiliateCountrySelectorProps {
  selected: string[] | null;
  onChange: (countries: string[] | null) => void;
  compact?: boolean;
}

export function AffiliateCountrySelector({ selected, onChange, compact = false }: AffiliateCountrySelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // null means all countries, empty array means none, array means specific countries
  const isAllCountries = selected === null;
  const selectedCodes = selected || [];

  const filteredCountries = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return Object.entries(countryData);
    return Object.entries(countryData).filter(([code, country]) =>
      code.toLowerCase().includes(query) ||
      country.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const toggle = (code: string) => {
    if (isAllCountries) {
      // Switching from "all" to specific - select all except this one
      const allCodes = Object.keys(countryData);
      onChange(allCodes.filter(c => c !== code));
    } else if (selectedCodes.includes(code)) {
      const newSelection = selectedCodes.filter(c => c !== code);
      // If empty after removal, keep as empty array (no countries)
      onChange(newSelection);
    } else {
      onChange([...selectedCodes, code]);
    }
  };

  const selectAllFiltered = () => {
    const filteredCodes = filteredCountries.map(([code]) => code);
    if (isAllCountries) {
      // Already all selected
      return;
    }
    const newSelected = [...new Set([...selectedCodes, ...filteredCodes])];
    onChange(newSelected);
  };

  const clearAll = () => {
    // Clear all = empty array = no countries allowed
    onChange([]);
  };

  const setAllCountries = () => {
    // All countries = null
    onChange(null);
  };

  const displayText = isAllCountries
    ? "All Countries"
    : selectedCodes.length === 0
      ? "None Selected"
      : `${selectedCodes.length} countries`;

  return (
    // NOTE: This selector is opened inside other dialogs (Edit/Create Affiliate).
    // Use non-modal dialog to avoid nested focus-lock issues that can make the UI feel “stuck”.
    <Dialog open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DialogTrigger asChild>
        {compact ? (
          <Button variant="outline" size="sm" className="h-8">
            <Settings2 className="h-3 w-3 mr-1" />
            {displayText}
          </Button>
        ) : (
          <Button variant="outline" className="w-full justify-start">
            <Settings2 className="h-4 w-4 mr-2" />
            {displayText}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Allowed Countries</DialogTitle>
          <DialogDescription>
            Select which countries this affiliate is allowed to send leads from.
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by country name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={isAllCountries ? "default" : "outline"} onClick={setAllCountries}>
            All Countries
          </Button>
          <Button size="sm" variant="outline" onClick={selectAllFiltered} disabled={isAllCountries}>
            Select All {searchQuery && `(${filteredCountries.length})`}
          </Button>
          <Button size="sm" variant="outline" onClick={clearAll}>
            Clear All
          </Button>
          {!isAllCountries && (
            <span className="text-sm text-muted-foreground self-center ml-auto">
              {selectedCodes.length} selected
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 overflow-y-auto flex-1 max-h-[50vh]">
          {filteredCountries.map(([code, country]) => {
            const isChecked = isAllCountries || selectedCodes.includes(code);
            return (
              <div
                key={code}
                className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                onClick={() => toggle(code)}
              >
                {/* Checkbox is visual-only; click handling is on the row to prevent double-toggle issues */}
                <Checkbox checked={isChecked} className="pointer-events-none" />
                <span className="text-sm font-medium">{code}</span>
                <span className="text-sm text-muted-foreground truncate">{country.name}</span>
              </div>
            );
          })}
          {filteredCountries.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No countries found matching "{searchQuery}"
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CountryBadges({ countries }: { countries: string[] | null }) {
  if (countries === null) {
    return <Badge variant="secondary">All Countries</Badge>;
  }

  if (!countries || countries.length === 0) {
    return <Badge variant="destructive">None Allowed</Badge>;
  }

  if (countries.length <= 3) {
    return (
      <div className="flex gap-1 flex-wrap">
        {countries.map(code => (
          <Badge key={code} variant="outline" className="text-xs">
            {code}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <Badge variant="outline">
      {countries.length} countries
    </Badge>
  );
}
