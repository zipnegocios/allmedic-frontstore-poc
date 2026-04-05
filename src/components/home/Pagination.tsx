import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-[#E5E5E5]">
      {/* Info */}
      <p className="text-sm text-gray-500">
        Mostrando <span className="font-medium text-[#111111]">{startItem}</span> -{' '}
        <span className="font-medium text-[#111111]">{endItem}</span> de{' '}
        <span className="font-medium text-[#111111]">{totalItems}</span> productos
      </p>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200',
            currentPage === 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-[#333333] hover:bg-[#F5F5F7]'
          )}
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>

        {/* Page Numbers */}
        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...'}
            className={cn(
              'min-w-[40px] h-10 px-3 flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200',
              page === currentPage
                ? 'bg-[#111111] text-white'
                : page === '...'
                ? 'text-gray-400 cursor-default'
                : 'text-[#333333] hover:bg-[#F5F5F7]'
            )}
          >
            {page}
          </button>
        ))}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200',
            currentPage === totalPages
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-[#333333] hover:bg-[#F5F5F7]'
          )}
        >
          <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
