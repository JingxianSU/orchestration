import * as React from "react";
import "./App.css";
import { AdminDashboard } from "./components/component/adminDashboard";
import { ClientChat } from "./components/component/clientChat";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip";

type SelectedMessageInfo = {
  traceId: string;
  messageId?: string;
  role: "user" | "assistant";
};

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------
export default function AdminParent(): React.JSX.Element {
  const [selectedInfo, setSelectedInfo] =
    React.useState<SelectedMessageInfo | null>(null);
  const [syncScroll, setSyncScroll] = React.useState<boolean>(false);
  const [autoMode, setAutoMode] = React.useState<boolean>(false);
  const [showClientChat, setShowClientChat] = React.useState<boolean>(true);

  return (
    <div className="min-h-screen bg-background flex w-full">
      <div className="flex-1 border-r border-border">
        <AdminDashboard
          externalSelectedInfo={selectedInfo}
          syncScroll={syncScroll}
          onSyncScrollChange={setSyncScroll}
          autoMode={autoMode}
          onAutoModeChange={setAutoMode}
        />
      </div>

      <div className="relative flex items-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClientChat(!showClientChat)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 h-12 w-6 rounded-full border bg-background shadow-md hover:bg-accent p-0"
              >
                {showClientChat ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {showClientChat ? "Hide Panel" : "Show Panel"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div
        className={`flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          showClientChat ? "w-[30%]" : "w-0"
        }`}
      >
        <div className="w-full h-full min-w-[300px] flex flex-col">
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <ClientChat
              onMessageSelect={setSelectedInfo}
              syncScroll={syncScroll}
              autoMode={autoMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
