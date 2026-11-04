export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    game: (
      <>
        <path d="M7 8h10l4 11-4 1-3-4h-4l-3 4-4-1z" />
        <path d="M7 12h4m-2-2v4m7-3h.01m2 3h.01" />
      </>
    ),
    bolt: <path d="M13 2 4 14h7l-1 8 10-13h-7z" />,
    wheel: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2" />
        <path d="m6 6 4 4m4 4 4 4M6 18l4-4m4-4 4-4M12 3v7m0 4v7M3 12h7m4 0h7" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 1h8" />
      </>
    ),
    hamster: (
      <>
        <path d="M6 9C0 1 10 0 9 7m6 0c-1-7 9-6 3 2M5 10l-2 8 4 3h10l4-3-2-8-4-3H9z" />
        <path d="M8 13h.01m8 0h.01m-5 4h2m-7 0H3m15 0h3" />
      </>
    ),
    chain: (
      <>
        <path
          d="m10 14 4-4M9 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"
          transform="translate(1 0)"
        />
      </>
    ),
    rocket: (
      <>
        <path d="m8 15-3-3C7 5 14 3 21 3c0 7-2 14-9 16l-3-3m-1-1-3 4 4-3M5 12H2l4-6h5m1 13v3l6-4v-5" />
        <circle cx="16" cy="8" r="2" />
      </>
    ),
    heart: (
      <path d="M20 5c-3-3-7-1-8 2-1-3-5-5-8-2-4 4 0 9 8 15 8-6 12-11 8-15Z" />
    ),
    flame: (
      <path d="M12 2c2 6-4 7-1 11 1-3 3-4 4-6 6 5 7 13-2 15-10-1-10-10-5-15-1 5 1 5 1 5 0-5 4-6 3-10Z" />
    ),
    wallet: (
      <>
        <path d="M20 7H4V4h15v3M4 7v13h17V7m0 5h-6v4h6" />
        <path d="M17 14h.01" />
      </>
    ),
    sound: (
      <>
        <path d="M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    muted: (
      <>
        <path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6" />
      </>
    ),
    pause: (
      <>
        <path d="M8 4v16M16 4v16" />
      </>
    ),
    play: <path d="m7 4 14 8-14 8z" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    external: (
      <>
        <path d="M13 4h7v7m0-7L9 15M9 4H4v16h16v-5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L20 5" />,
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8c0-4 7-3 6 1-.5 2-3 2-3 5m0 3h.01" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3" />
      </>
    ),
    spark: <path d="m12 2 2 7 7 3-7 2-2 8-3-8-7-2 7-3z" />,
    refresh: (
      <>
        <path d="M20 8a8 8 0 1 0 1 7m-1-13v6h-6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.bolt}
    </svg>
  );
}
