"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface UsersPaginationProps {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function UsersPagination({
  currentPage,
  totalPages,
  totalUsers,
  pageSize,
  onPageChange,
}: UsersPaginationProps) {
  if (totalUsers === 0) return null;

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalUsers);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
      {/* Records range indicator */}
      <div>
        Showing <span className="font-semibold text-foreground">{startRecord}</span>–
        <span className="font-semibold text-foreground">{endRecord}</span> of{" "}
        <span className="font-semibold text-foreground">{totalUsers}</span> users
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-muted-foreground disabled:opacity-40"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
          <span className="sr-only">First page</span>
        </Button>

        {/* Previous Page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-muted-foreground disabled:opacity-40"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground/60">
                  …
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <Button
                key={p}
                variant={isCurrent ? "default" : "outline"}
                size="icon"
                className={cn(
                  "h-8 w-8 text-xs font-semibold",
                  isCurrent 
                    ? "bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white" 
                    : "text-foreground hover:bg-muted"
                )}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </Button>
            );
          })}
        </div>

        {/* Next Page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-muted-foreground disabled:opacity-40"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Button>

        {/* Last Page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-muted-foreground disabled:opacity-40"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || totalPages === 0}
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
          <span className="sr-only">Last page</span>
        </Button>
      </div>
    </div>
  );
}
