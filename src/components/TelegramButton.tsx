import React from 'react';
import { Download } from 'lucide-react';

interface TelegramButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const TelegramButton: React.FC<TelegramButtonProps> = ({
  onClick,
  disabled = false,
  isLoading = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label="ទាញយក ឬផ្ញើទៅ Telegram"
      className="min-h-[44px] px-3.5 rounded-xl btn-primary text-xs font-semibold disabled:opacity-60 transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
    >
      <Download className="w-4 h-4 shrink-0" />
      <span>{isLoading ? 'កំពុងបង្កើត...' : 'ទាញយក'}</span>
    </button>
  );
};
