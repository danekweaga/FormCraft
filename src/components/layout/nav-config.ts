export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/roadmap", label: "Roadmap", icon: "flag" },
  { href: "/research", label: "Research", icon: "explore" },
  { href: "/canvas", label: "Canvas", icon: "dashboard" },
  { href: "/create", label: "Create", icon: "edit_note" },
  { href: "/plan", label: "Plan", icon: "calendar_today" },
  { href: "/my-content", label: "My Content", icon: "movie" },
  { href: "/analyze", label: "Analyze", icon: "troubleshoot" },
  { href: "/experiments", label: "Experiments", icon: "science" },
  { href: "/audience", label: "Audience", icon: "groups" },
  { href: "/pre-publish", label: "Pre-Publish", icon: "fact_check" },
  { href: "/performance", label: "Performance", icon: "analytics" },
  { href: "/library", label: "Library", icon: "auto_stories" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/knowledge", label: "Teach FormCraft", icon: "school" },
  { href: "/idea-gate", label: "Idea Gate", icon: "lightbulb" },
  { href: "/brand-brain", label: "Brand Brain", icon: "psychology" },
  { href: "/connections", label: "Connections", icon: "link" },
  { href: "/models", label: "Models", icon: "smart_toy" },
  { href: "/usage", label: "Usage", icon: "data_usage" },
  { href: "/templates", label: "Templates", icon: "content_copy" },
  { href: "/settings", label: "Settings", icon: "settings" },
];
