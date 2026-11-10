const paths = {
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  calendar: "M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",
  clock: "M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  folder: "M3 7V5h6l2 2h10v13H3V7Z",
  refresh: "M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6",
  report: "M8 3h8v4H8V3ZM8 5H5v16h14V5h-3M8 12h8m-8 4h5",
  news: "M4 4h16v16H4V4Zm4 4h8m-8 4h8m-8 4h5",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  close: "m6 6 12 12M6 18 18 6",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
};
export function DashboardIcon({
  name,
  className = "",
}: {
  name: keyof typeof paths;
  className?: string;
}) {
  return (
    <svg
      className={`dashboard-icon ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
