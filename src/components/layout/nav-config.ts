export type NavItem = {
  href: string;
  label: string;
  icon: string;
  group?: "Intelligence" | "Workspace" | "Configure";
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/research", label: "Discover", icon: "explore" },
  { href: "/create", label: "Build", icon: "edit_note" },
  { href: "/analyze", label: "Analyze", icon: "troubleshoot" },
  { href: "/my-content", label: "My Content", icon: "movie" },
  { href: "/library", label: "Library", icon: "auto_stories" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/brand-brain", label: "Content System", icon: "account_tree", group: "Intelligence" },
  { href: "/dashboard", label: "Dashboard", icon: "home", group: "Intelligence" },
  { href: "/performance", label: "Performance", icon: "analytics", group: "Intelligence" },
  { href: "/roadmap", label: "Roadmap", icon: "flag", group: "Intelligence" },
  { href: "/experiments", label: "Experiments", icon: "science", group: "Intelligence" },
  { href: "/audience", label: "Audience", icon: "groups", group: "Intelligence" },
  { href: "/creators", label: "Creators", icon: "person_search", group: "Workspace" },
  { href: "/hooks", label: "Hooks", icon: "key", group: "Workspace" },
  { href: "/collections", label: "Formats", icon: "collections_bookmark", group: "Workspace" },
  { href: "/canvas", label: "Canvas", icon: "dashboard", group: "Workspace" },
  { href: "/series", label: "Repurpose + Series", icon: "conversion_path", group: "Workspace" },
  { href: "/idea-gate", label: "Idea Gate", icon: "lightbulb", group: "Workspace" },
  { href: "/pre-publish", label: "Pre-Publish", icon: "fact_check", group: "Workspace" },
  { href: "/persona", label: "Creator Profile", icon: "person", group: "Configure" },
  { href: "/knowledge", label: "Teach FormCraft", icon: "school", group: "Configure" },
  { href: "/psychology", label: "Psychology", icon: "psychology", group: "Configure" },
  { href: "/connections", label: "Connections", icon: "link", group: "Configure" },
  { href: "/models", label: "Models", icon: "smart_toy", group: "Configure" },
  { href: "/usage", label: "Usage", icon: "data_usage", group: "Configure" },
  { href: "/settings", label: "Settings", icon: "settings", group: "Configure" },
];
