"use client";

import React, { useState } from "react";
import {
  Filter,
  ChevronDown,
  ChevronRight,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { FilterOption, FilterOptions, FilterState } from "./types";
import { getIconComponent } from "./constants";
import FilterOptionEditor from "./FilterOptionEditor";

// ============ Filter Panel Component ============
interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  filterOptions: FilterOptions;
  onFilterOptionsChange: (options: FilterOptions) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  filterOptions,
  onFilterOptionsChange,
}) => {
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "domain",
    "intent",
    "status",
  ]);
  const [editingCategory, setEditingCategory] = useState<{
    key: keyof FilterOptions;
    title: string;
    showIcon?: boolean;
    showColor?: boolean;
    showDescription?: boolean;
  } | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section],
    );
  };

  const toggleFilter = (category: keyof FilterState, value: string) => {
    if (Array.isArray(filters[category])) {
      const current = filters[category] as string[];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFilterChange({ ...filters, [category]: updated });
    }
  };

  const clearAllFilters = () => {
    onFilterChange({
      domains: [],
      jurisdictions: [],
      intentTypes: [],
      scopes: [],
      enforcements: [],
      strengths: [],
      statuses: [],
      inferenceModels: [],
      trustWorthys: [],
      search: "",
    });
  };

  const activeFilterCount =
    filters.domains.length +
    filters.jurisdictions.length +
    filters.intentTypes.length +
    filters.scopes.length +
    filters.enforcements.length +
    filters.strengths.length +
    filters.statuses.length +
    filters.inferenceModels.length +
    filters.trustWorthys.length;

  const handleOptionsChange = (
    key: keyof FilterOptions,
    options: FilterOption[],
  ) => {
    onFilterOptionsChange({ ...filterOptions, [key]: options });
  };

  const FilterSection = ({
    id,
    title,
    items,
    selected,
    category,
    optionsKey,
    showIcon = false,
    showColor = false,
    showDescription = false,
  }: {
    id: string;
    title: string;
    items: FilterOption[];
    selected: string[];
    category: keyof FilterState;
    optionsKey: keyof FilterOptions;
    showIcon?: boolean;
    showColor?: boolean;
    showDescription?: boolean;
  }) => (
    <Collapsible
      open={expandedSections.includes(id)}
      onOpenChange={() => toggleSection(id)}
    >
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="flex items-center justify-between flex-1 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
          <span className="flex items-center gap-2">
            {title}
            {selected.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {selected.length}
              </Badge>
            )}
          </span>
          {expandedSections.includes(id) ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCategory({
                    key: optionsKey,
                    title,
                    showIcon,
                    showColor,
                    showDescription,
                  });
                }}
              >
                <Settings className="h-3 w-3 text-gray-400 hover:text-gray-600" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Manage {title} options</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <CollapsibleContent className="space-y-1 pb-3">
        {items.map((item) => {
          const IconComp = showIcon ? getIconComponent(item.icon) : null;
          return (
            <label
              key={item.value}
              className="flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-gray-50"
            >
              <Checkbox
                checked={selected.includes(item.value)}
                onCheckedChange={() => toggleFilter(category, item.value)}
              />
              {showColor && item.color && (
                <div className={cn("w-3 h-3 rounded", item.color)} />
              )}
              {IconComp && <IconComp className="h-4 w-4 text-gray-500" />}
              <span className="text-sm text-gray-600">{item.label}</span>
            </label>
          );
        })}
        {items.length === 0 && (
          <p className="text-xs text-gray-400 py-2">No options available</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <>
      <div className="w-64 border-r bg-gray-50/50 flex flex-col h-full">
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </h3>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-7 text-xs text-gray-500 hover:text-gray-700"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-1">
            <FilterSection
              id="domain"
              title="Domain"
              items={filterOptions.domains}
              selected={filters.domains}
              category="domains"
              optionsKey="domains"
              showIcon
            />
            <Separator className="my-2" />
            <FilterSection
              id="jurisdiction"
              title="Jurisdiction"
              items={filterOptions.jurisdictions}
              selected={filters.jurisdictions}
              category="jurisdictions"
              optionsKey="jurisdictions"
            />
            <Separator className="my-2" />
            <FilterSection
              id="intent"
              title="Policy Intent"
              items={filterOptions.intentTypes}
              selected={filters.intentTypes}
              category="intentTypes"
              optionsKey="intentTypes"
              showIcon
            />
            <Separator className="my-2" />
            <FilterSection
              id="scope"
              title="Scope"
              items={filterOptions.scopes}
              selected={filters.scopes}
              category="scopes"
              optionsKey="scopes"
            />
            <Separator className="my-2" />
            <FilterSection
              id="enforcement"
              title="Enforcement Point"
              items={filterOptions.enforcements}
              selected={filters.enforcements}
              category="enforcements"
              optionsKey="enforcements"
              showDescription
            />
            <Separator className="my-2" />
            <FilterSection
              id="strength"
              title="Strength"
              items={filterOptions.strengths}
              selected={filters.strengths}
              category="strengths"
              optionsKey="strengths"
              showColor
            />
            <Separator className="my-2" />
            <FilterSection
              id="status"
              title="Status"
              items={filterOptions.statuses}
              selected={filters.statuses}
              category="statuses"
              optionsKey="statuses"
              showColor
            />
            <Separator className="my-2" />
            <FilterSection
              id="inferenceModel"
              title="Inference Model"
              items={filterOptions.inferenceModels}
              selected={filters.inferenceModels}
              category="inferenceModels"
              optionsKey="inferenceModels"
              showIcon
              showDescription
            />
            <Separator className="my-2" />
            <FilterSection
              id="trustWorthy"
              title="Trust Worthy"
              items={filterOptions.trustWorthys}
              selected={filters.trustWorthys}
              category="trustWorthys"
              optionsKey="trustWorthys"
              showColor
            />
          </div>
        </ScrollArea>
      </div>

      {/* Filter Option Editor Dialog */}
      {editingCategory && (
        <FilterOptionEditor
          open={!!editingCategory}
          onClose={() => setEditingCategory(null)}
          categoryKey={editingCategory.key}
          categoryTitle={editingCategory.title}
          options={filterOptions[editingCategory.key]}
          onOptionsChange={(options) =>
            handleOptionsChange(editingCategory.key, options)
          }
          showIcon={editingCategory.showIcon}
          showColor={editingCategory.showColor}
          showDescription={editingCategory.showDescription}
        />
      )}
    </>
  );
};

export default FilterPanel;
