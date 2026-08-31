import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
  className,
  ...props
}) => {
  const generatePageNumbers = () => {
    const pages = [];
    const delta = 2; // Number of pages to show on each side of current page

    // Always show first page
    if (1 < currentPage - delta) {
      pages.push(1);
      if (2 < currentPage - delta) {
        pages.push("...");
      }
    }

    // Show pages around current page
    for (
      let i = Math.max(1, currentPage - delta);
      i <= Math.min(totalPages, currentPage + delta);
      i++
    ) {
      pages.push(i);
    }

    // Always show last page
    if (totalPages > currentPage + delta) {
      if (totalPages - 1 > currentPage + delta) {
        pages.push("...");
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = generatePageNumbers();

  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    >
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
            className={cn(currentPage <= 1 && "pointer-events-none opacity-50")}
          />
        </PaginationItem>

        {pageNumbers.map((page, index) => (
          <PaginationItem key={index}>
            {page === "..." ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                onClick={() => onPageChange(page)}
                isActive={page === currentPage}
              >
                {page}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            onClick={() =>
              currentPage < totalPages && onPageChange(currentPage + 1)
            }
            className={cn(
              currentPage >= totalPages && "pointer-events-none  opacity-50",
            )}
          />
        </PaginationItem>
      </PaginationContent>
    </nav>
  );
};
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn(
      "flex flex-col sm:flex-row items-center gap-1 sm:gap-1",
      className,
    )}
    {...props}
  />
));
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
));
PaginationItem.displayName = "PaginationItem";

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  onClick,
  ...props
}) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      "h-8 pr-2 pl-2 sm:h-9 w-full text-xs sm:text-sm",
      className,
    )}
    onClick={onClick}
    style={{ cursor: "pointer" }}
    {...props}
  />
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({ className, ...props }) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn(
      "gap-1 bg-teal-500   h-8 sm:h-9 text-xs sm:text-sm",
      className,
    )}
    {...props}
  >
    {/* <ChevronLeft className="h-3 text-white w-3 sm:h-4 sm:w-4" /> */}
    <span className="text-white hover:text-black">Previous</span>
  </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({ className, ...props }) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn(
      "gap-1  bg-teal-500  h-8 sm:h-9 text-xs sm:text-sm",
      className,
    )}
    {...props}
  >
    <span className="text-white hover:text-black ">Next</span>
    {/* <ChevronRight className="h-3 text-white w-3 sm:h-4 sm:w-4" /> */}
  </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({ className, ...props }) => (
  <span
    aria-hidden
    className={cn(
      "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center",
      className,
    )}
    {...props}
  >
    <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
