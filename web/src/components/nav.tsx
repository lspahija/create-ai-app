import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Strategies", end: true },
  { to: "/jobs", label: "Jobs" },
  { to: "/settings", label: "Settings" },
];

export function Nav() {
  return (
    <nav className="flex items-center gap-1">
      {links.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
