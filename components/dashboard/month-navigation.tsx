import { DashboardIcon } from "./icon.tsx";
export function monthLabel(month: string) {
  const [year] = month.split("-");
  const name = new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  return `${year} / ${name}`;
}
export function MonthNavigation({
  month,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
}: {
  month: string;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
}) {
  return (
    <div className="dashboard-calendar-heading">
      <button
        type="button"
        className="dashboard-icon-button"
        aria-label="Previous month"
        disabled={previousDisabled}
        onClick={onPrevious}
      >
        <DashboardIcon name="left" />
      </button>
      <h3 aria-live="polite">{monthLabel(month)}</h3>
      <button
        type="button"
        className="dashboard-icon-button"
        aria-label="Next month"
        disabled={nextDisabled}
        onClick={onNext}
      >
        <DashboardIcon name="right" />
      </button>
    </div>
  );
}
