// ─── Enterprise SVG Icon System ───────────────────────────────────────────────
// Inline SVG icons (Lucide-style, 24px viewBox, 1.5px stroke).
// No icon library dependency — zero bundle overhead.

import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, children: React.ReactNode, props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

export const IconBrain = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <path d="M9 3a4 4 0 0 1 6 3.46V21" />
    <path d="M3 9a4 4 0 0 1 6-3.46" />
    <path d="M3 9c0 2.21 1.79 4 4 4h10a4 4 0 0 0 0-8H7" />
    <path d="M9 21H7a4 4 0 0 1 0-8" />
    <path d="M15 21h2a4 4 0 0 0 0-8" />
  </>, p);

export const IconMic = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="22" x2="12" y2="18" />
    <line x1="9" y1="22" x2="15" y2="22" />
  </>, p);

export const IconMicOff = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M18.89 13.23A7 7 0 0 0 19 11" />
    <path d="M5 11a7 7 0 0 0 12.94 2.94" />
    <path d="M9 9V5a3 3 0 0 1 5.12-2.12" />
    <path d="M15 9.34V12a3 3 0 0 1-5.68 1.42" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="9" y1="22" x2="15" y2="22" />
  </>, p);

export const IconZap = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </>, p);

export const IconMessageSquare = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </>, p);

export const IconSettings = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>, p);

export const IconDownload = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>, p);

export const IconFilePdf = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="12" y2="17" />
  </>, p);

export const IconRefreshCw = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </>, p);

export const IconSearch = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>, p);

export const IconEdit3 = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </>, p);

export const IconPin = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
  </>, p);

export const IconCopy = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>, p);

export const IconCheck = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <polyline points="20 6 9 17 4 12" />
  </>, p);

export const IconX = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>, p);

export const IconWifi = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 16 0 0 1 6.95 0" />
    <circle cx="12" cy="20" r="1" fill="currentColor" />
  </>, p);

export const IconWifiOff = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a11 11 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <circle cx="12" cy="20" r="1" fill="currentColor" />
  </>, p);

export const IconChevronDown = ({ size = 16, ...p }: IconProps) =>
  base(size, <polyline points="6 9 12 15 18 9" />, p);

export const IconChevronUp = ({ size = 16, ...p }: IconProps) =>
  base(size, <polyline points="18 15 12 9 6 15" />, p);

export const IconActivity = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </>, p);

export const IconAlertCircle = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </>, p);

export const IconUpload = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </>, p);

export const IconSend = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </>, p);

export const IconKeyboard = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
  </>, p);

export const IconClock = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>, p);

export const IconFileText = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </>, p);

export const IconTrash2 = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </>, p);

export const IconBookmark = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </>, p);

export const IconMonitor = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </>, p);

export const IconLogOut = ({ size = 16, ...p }: IconProps) =>
  base(size, <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </>, p);
