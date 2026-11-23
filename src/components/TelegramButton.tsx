import React from 'react';

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
      aria-label="ចែករំលែកទៅ Telegram"
      className="min-h-[44px] px-3.5 rounded-xl bg-gradient-to-b from-[#2AA8E8] to-[#1A8AC5] hover:from-[#34B2F0] hover:to-[#1E94D1] text-white text-xs font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.12),0_4px_12px_-2px_rgba(34,158,217,0.4),inset_0_1px_0_rgba(255,255,255,0.26)] active:scale-[0.98] disabled:opacity-60 transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="w-4 h-4 shrink-0"
      >
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
      <span>{isLoading ? 'កំពុងបង្កើត...' : 'Telegram'}</span>
    </button>
  );
};
