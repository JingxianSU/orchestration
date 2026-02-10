"use client";

import React, { useState } from "react";
import { Trash2, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

import type { Source } from "./types";

const SourceManager: React.FC<{
  sources: Source[];
  onChange: (sources: Source[]) => void;
}> = ({ sources, onChange }) => {
  const [newSource, setNewSource] = useState<Source>({
    type: "regulation",
    reference: "",
  });

  const removeSource = (index: number) => {
    const target = sources[index];
    // clean object URL if exists
    if (target?.fileUrl?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(target.fileUrl);
      } catch {}
    }
    onChange((sources || []).filter((_, i) => i !== index));
  };

  const updateSource = (index: number, patch: Partial<Source>) => {
    const updated = [...(sources || [])];
    updated[index] = { ...updated[index], ...patch };
    onChange(updated);
  };

  const updateFileName = (index: number, renamedName: string) => {
    const src = sources[index];
    updateSource(index, {
      fileMeta: src.fileMeta
        ? { ...src.fileMeta, renamedName }
        : {
            originalName: renamedName,
            renamedName,
            size: 0,
            mime: "",
          },
      reference: renamedName,
    });
  };

  const handleFileUpload = (file: File) => {
    const fileUrl = URL.createObjectURL(file);

    const fileSource: Source = {
      type: "internal",
      reference: file.name,
      fileMeta: {
        originalName: file.name,
        renamedName: file.name,
        size: file.size,
        mime: file.type,
      },
      fileUrl,
    };

    onChange([...(sources || []), fileSource]);
  };

  return (
    <div className="space-y-4">
      {/* Existing sources */}
      <div className="space-y-2">
        {(sources || []).length > 0 ? (
          (sources || []).map((src, idx) => {
            const isFile = !!src.fileMeta;

            return (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 bg-gray-50 rounded"
              >
                <Badge variant="outline" className="text-xs mt-0.5">
                  {src.type}
                </Badge>

                <div className="flex-1 min-w-0 space-y-1">
                  {isFile ? (
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">
                        File name (editable)
                      </Label>
                      <Input
                        className="h-8"
                        value={src.fileMeta?.renamedName || ""}
                        onChange={(e) => updateFileName(idx, e.target.value)}
                      />
                      <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                        <span>Original: {src.fileMeta?.originalName}</span>
                        <span>•</span>
                        <span>
                          {(src.fileMeta?.size || 0) > 0
                            ? `${Math.round((src.fileMeta!.size / 1024) * 10) / 10} KB`
                            : "-"}
                        </span>
                        <span>•</span>
                        <span>{src.fileMeta?.mime || "-"}</span>
                      </div>

                      {src.fileUrl && (
                        <a
                          href={src.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Preview
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm text-gray-700 break-words">
                        {src.reference}
                      </div>
                      {src.url && (
                        <div className="text-xs text-blue-600 break-all">
                          {src.url}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 ml-auto text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeSource(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-gray-500 italic">
            No source added yet.
          </div>
        )}
      </div>

      <Separator />

      {/* Upload file */}
      <div className="grid grid-cols-12 gap-4 items-end">
        {/* Type */}
        <div className="col-span-12 md:col-span-3 space-y-2">
          <Label className="text-xs">Type</Label>
          <Select
            value={newSource.type}
            onValueChange={(value) =>
              setNewSource({
                ...newSource,
                type: value as "regulation" | "standard" | "internal",
              })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regulation">Regulation</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Upload */}
        <div className="col-span-12 md:col-span-9 space-y-2">
          <Label className="text-xs">Upload file</Label>
          <div className="flex items-center gap-3">
            <Input
              type="file"
              className="h-9 flex-1"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                handleFileUpload(f);
                e.currentTarget.value = "";
              }}
            />
            <p className="text-xs text-gray-500 hidden lg:block">
              Upload a policy PDF/doc; you can rename it after upload.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SourceManager;
