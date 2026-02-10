"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Trash2,
  Plus,
  Pencil,
  GripVertical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { FilterOption, FilterOptions } from "./types";
import { ICON_MAP, ICON_OPTIONS } from "./constants";

// ============ Filter Option Editor Dialog ============
interface FilterOptionEditorProps {
  open: boolean;
  onClose: () => void;
  categoryKey: keyof FilterOptions;
  categoryTitle: string;
  options: FilterOption[];
  onOptionsChange: (options: FilterOption[]) => void;
  showIcon?: boolean;
  showColor?: boolean;
  showDescription?: boolean;
}

const FilterOptionEditor: React.FC<FilterOptionEditorProps> = ({
  open,
  onClose,
  categoryKey: _categoryKey,
  categoryTitle,
  options,
  onOptionsChange,
  showIcon = false,
  showColor = false,
  showDescription = false,
}) => {
  const [localOptions, setLocalOptions] = useState<FilterOption[]>(options);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newOption, setNewOption] = useState<FilterOption>({
    value: "",
    label: "",
    icon: "",
    color: "",
    description: "",
  });

  React.useEffect(() => {
    setLocalOptions(options);
  }, [options]);

  const handleAddOption = () => {
    if (newOption.value && newOption.label) {
      setLocalOptions([...localOptions, { ...newOption }]);
      setNewOption({
        value: "",
        label: "",
        icon: "",
        color: "",
        description: "",
      });
    }
  };

  const handleUpdateOption = (
    index: number,
    field: keyof FilterOption,
    value: string,
  ) => {
    const updated = [...localOptions];
    updated[index] = { ...updated[index], [field]: value };
    setLocalOptions(updated);
  };

  const handleDeleteOption = (index: number) => {
    setLocalOptions(localOptions.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onOptionsChange(localOptions);
    onClose();
  };

  const COLOR_OPTIONS = [
    { value: "bg-red-500", label: "Red" },
    { value: "bg-red-600", label: "Dark Red" },
    { value: "bg-orange-500", label: "Orange" },
    { value: "bg-amber-500", label: "Amber" },
    { value: "bg-amber-600", label: "Dark Amber" },
    { value: "bg-yellow-500", label: "Yellow" },
    { value: "bg-green-500", label: "Green" },
    { value: "bg-blue-500", label: "Blue" },
    { value: "bg-purple-500", label: "Purple" },
    { value: "bg-gray-500", label: "Gray" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>Manage {categoryTitle} Options</DialogTitle>
          <DialogDescription>
            Add, edit, or remove filter options for{" "}
            {categoryTitle.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4 pb-4">
              {/* Existing Options */}
              <div className="space-y-2">
                {localOptions.map((option, index) => (
                  <div
                    key={`${option.value}-${index}`}
                    className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50"
                  >
                    <GripVertical className="h-4 w-4 text-gray-400 cursor-move flex-shrink-0" />

                    {editingIndex === index ? (
                      // Edit Mode
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Value (unique key)"
                          value={option.value}
                          onChange={(e) =>
                            handleUpdateOption(index, "value", e.target.value)
                          }
                          className="h-8"
                        />
                        <Input
                          placeholder="Label"
                          value={option.label}
                          onChange={(e) =>
                            handleUpdateOption(index, "label", e.target.value)
                          }
                          className="h-8"
                        />
                        {showIcon && (
                          <Select
                            value={option.icon || ""}
                            onValueChange={(v) =>
                              handleUpdateOption(index, "icon", v)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select icon" />
                            </SelectTrigger>
                            <SelectContent>
                              {ICON_OPTIONS.map((icon) => {
                                const IconComp = ICON_MAP[icon];
                                return (
                                  <SelectItem key={icon} value={icon}>
                                    <div className="flex items-center gap-2">
                                      <IconComp className="h-4 w-4" />
                                      {icon}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        )}
                        {showColor && (
                          <Select
                            value={option.color || ""}
                            onValueChange={(v) =>
                              handleUpdateOption(index, "color", v)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select color" />
                            </SelectTrigger>
                            <SelectContent>
                              {COLOR_OPTIONS.map((color) => (
                                <SelectItem
                                  key={color.value}
                                  value={color.value}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "w-4 h-4 rounded",
                                        color.value,
                                      )}
                                    />
                                    {color.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {showDescription && (
                          <Input
                            placeholder="Description"
                            value={option.description || ""}
                            onChange={(e) =>
                              handleUpdateOption(
                                index,
                                "description",
                                e.target.value,
                              )
                            }
                            className="h-8 col-span-2"
                          />
                        )}
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        {showIcon &&
                          option.icon &&
                          (() => {
                            const IconComp = ICON_MAP[option.icon] || null;
                            return IconComp ? (
                              <IconComp className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            ) : null;
                          })()}
                        {showColor && option.color && (
                          <div
                            className={cn(
                              "w-4 h-4 rounded flex-shrink-0",
                              option.color,
                            )}
                          />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({option.value})
                          </span>
                          {showDescription && option.description && (
                            <p className="text-xs text-gray-500 truncate">
                              {option.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() =>
                          setEditingIndex(editingIndex === index ? null : index)
                        }
                      >
                        {editingIndex === index ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Pencil className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteOption(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Option */}
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Add New Option</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Value (unique key)"
                    value={newOption.value}
                    onChange={(e) =>
                      setNewOption({ ...newOption, value: e.target.value })
                    }
                    className="h-9"
                  />
                  <Input
                    placeholder="Label"
                    value={newOption.label}
                    onChange={(e) =>
                      setNewOption({ ...newOption, label: e.target.value })
                    }
                    className="h-9"
                  />
                  {showIcon && (
                    <Select
                      value={newOption.icon || ""}
                      onValueChange={(v) =>
                        setNewOption({ ...newOption, icon: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select icon" />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map((icon) => {
                          const IconComp = ICON_MAP[icon];
                          return (
                            <SelectItem key={icon} value={icon}>
                              <div className="flex items-center gap-2">
                                <IconComp className="h-4 w-4" />
                                {icon}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {showColor && (
                    <Select
                      value={newOption.color || ""}
                      onValueChange={(v) =>
                        setNewOption({ ...newOption, color: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select color" />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div
                                className={cn("w-4 h-4 rounded", color.value)}
                              />
                              {color.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {showDescription && (
                    <Input
                      placeholder="Description (optional)"
                      value={newOption.description || ""}
                      onChange={(e) =>
                        setNewOption({
                          ...newOption,
                          description: e.target.value,
                        })
                      }
                      className="h-9 col-span-2"
                    />
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddOption}
                  disabled={!newOption.value || !newOption.label}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Option
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FilterOptionEditor;
