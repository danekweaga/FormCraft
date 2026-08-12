import type { ScoredResearchVideo } from "./types";

export type NicheUniverseContext = {
  mainNiche?: string | null;
  topics?: string[] | null;
  keywords?: string[] | null;
  excludedTopics?: string[] | null;
  targetAudience?: string | null;
};

export type ContentUniverseResult = {
  relevant: boolean;
  category: string | null;
  reason: string;
  matchedTerms: string[];
};

type Category = {
  name: string;
  terms: string[];
};

const CATEGORIES: Category[] = [
  {
    name: "Computer science student life",
    terms: [
      "computer science", "cs student", "software engineering student",
      "student developer", "coding student", "cs degree", "college coding",
      "university coding", "campus life", "student life", "professor",
      "office hours", "group project", "gpa", "exam", "assignment",
    ],
  },
  {
    name: "Learning programming",
    terms: [
      "learn programming", "learn to code", "programming", "coding",
      "developer", "software engineer", "debugging", "read code", "codebase",
      "data structure", "algorithm", "git", "api", "database", "testing",
      "frontend", "backend", "full stack", "web development", "framework",
      "command line", "stack overflow", "documentation", "python", "javascript",
      "typescript", "java programming", "c++", "c#", "rust programming",
      "c language", "computer system", "computer hardware", "softwareengineer",
      "computerscience", "computersciencestudent", "csmajor", "programmer",
    ],
  },
  {
    name: "Coding projects and building in public",
    terms: [
      "coding project", "software project", "portfolio project", "project idea",
      "build an app", "building an app", "built an app", "app development",
      "build in public", "building in public", "project demo", "build log",
      "mvp", "feature scope", "github project", "school project",
    ],
  },
  {
    name: "AI tools and commentary",
    terms: [
      "ai", "artificial intelligence", "chatgpt", "openai", "claude", "gemini",
      "cursor", "codex", "copilot", "llm", "large language model", "ai agent",
      "agentic", "vibe coding", "prompting", "mcp", "machine learning",
      "hallucination", "ai tool", "ai workflow", "ai coding",
    ],
  },
  {
    name: "Developer tools, cloud, and DevOps",
    terms: [
      "github", "gitlab", "vs code", "visual studio code", "terminal", "postman",
      "docker", "kubernetes", "devops", "ci/cd", "github actions", "vercel",
      "supabase", "firebase", "prisma", "postgresql", "aws", "azure", "gcp",
      "cloud computing", "cloud bill", "deployment", "deploy", "hosting",
      "serverless", "environment variable", "linux", "dns", "domain name",
    ],
  },
  {
    name: "Hackathons, opportunities, and early career",
    terms: [
      "hackathon", "internship", "intern application", "technical interview",
      "coding interview", "software interview", "career fair", "developer career",
      "tech career", "job ready", "job search", "resume", "portfolio website",
      "linkedin", "referral", "leetcode", "fellowship", "scholarship",
      "student opportunity", "open source contribution", "certification",
      "externship", "student grant", "student competition", "tech conference",
      "research opportunity", "student club",
    ],
  },
  {
    name: "Startups and student entrepreneurship",
    terms: [
      "startup", "student founder", "founder", "saas", "customer interview",
      "product validation", "validate an idea", "cofounder", "pitch competition",
      "startup grant", "waitlist", "product launch", "ship a product",
    ],
  },
  {
    name: "Tech industry and culture",
    terms: [
      "tech industry", "tech layoffs", "developer trend", "software trend",
      "technology news", "tech news", "open source", "developer culture",
      "programmer humor", "coding meme", "developer meme", "cs stereotype",
      "programming language", "tech twitter", "tech community",
    ],
  },
  {
    name: "Adjacent technology careers",
    terms: [
      "data science", "data scientist", "cybersecurity", "machine learning engineer",
      "product manager", "product management", "ux designer", "ux design",
      "qa engineer", "quality assurance", "solutions engineer", "technical sales",
      "developer relations", "devrel", "site reliability", "sre career",
      "cloud engineer", "ai engineer", "information technology career",
    ],
  },
  {
    name: "Tech products and student hardware",
    terms: [
      "laptop", "developer laptop", "student laptop", "keyboard", "monitor",
      "desk setup", "developer setup", "student tech", "gpu", "cpu", "ram",
      "mac vs windows", "windows vs mac", "operating system", "headphones",
      "tablet", "smartphone", "phone review", "computer storage", "ssd",
    ],
  },
  {
    name: "Student productivity and learning",
    terms: [
      "study routine", "student productivity", "study system", "note taking",
      "exam preparation", "student burnout", "learning system", "self teaching",
      "self taught developer", "coding tutorial", "online course", "ai tutor",
      "learn difficult", "tutorial hell", "procrastination as a student",
      "active recall", "metacognition", "time management for students",
      "student focus", "student motivation", "textbook", "course selection",
    ],
  },
  {
    name: "Creator experiments and behind the scenes",
    terms: [
      "creator tool", "content analytics", "video editing", "ai video editing",
      "content experiment", "content creation workflow", "tech creator",
      "building formcraft", "content performance", "short form strategy",
      "creator software", "social media analytics", "content workflow",
    ],
  },
  {
    name: "Developer costs and practical realities",
    terms: [
      "student discount", "api cost", "hosting cost", "developer subscription",
      "ai subscription", "software subscription", "cloud credit", "free tier",
      "domain cost", "hackathon cost", "is it worth paying",
    ],
  },
];

const OFF_NICHE_TERMS = [
  "makeup tutorial", "skincare routine", "celebrity gossip", "football highlights",
  "basketball highlights", "sports betting", "crypto trading signal", "forex signal",
  "weight loss diet", "bodybuilding workout", "recipe", "cooking tutorial",
  "fashion haul", "relationship drama", "prank compilation", "dance challenge",
];

const STOPWORDS = new Set([
  "about", "after", "again", "also", "being", "content", "from", "into",
  "only", "that", "their", "these", "this", "those", "video", "with", "your",
]);

function normalize(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9+./-]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

function includesTerm(haystack: string, term: string): boolean {
  const needle = normalize(term).trim();
  if (!needle) return false;
  return haystack.includes(` ${needle} `) || haystack.includes(` ${needle}s `);
}

function profileTerms(context?: NicheUniverseContext): string[] {
  if (!context) return [];
  return Array.from(
    new Set(
      [...(context.topics ?? []), ...(context.keywords ?? [])]
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length >= 3 && !STOPWORDS.has(term)),
    ),
  );
}

function queryTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9+#./-]+/)
        .filter((term) => term.length >= 3 && !STOPWORDS.has(term)),
    ),
  );
}

/**
 * Strict, deterministic gate for Nonso's stored student-tech/developer universe.
 * It uses only title/description metadata and never pretends to inspect visuals.
 */
export function classifyCreatorContentUniverse(
  item: Pick<ScoredResearchVideo, "title" | "description" | "creatorName">,
  query = "",
  context?: NicheUniverseContext,
): ContentUniverseResult {
  const haystack = normalize(
    `${item.title ?? ""} ${item.description ?? ""} ${item.creatorName ?? ""}`,
  );

  const explicitlyExcluded = (context?.excludedTopics ?? [])
    .map((term) => term.toLowerCase())
    .filter((term) => includesTerm(haystack, term));
  if (explicitlyExcluded.length > 0) {
    return {
      relevant: false,
      category: null,
      reason: "Matches a topic explicitly excluded in the niche profile",
      matchedTerms: explicitlyExcluded.slice(0, 5),
    };
  }

  const excluded = OFF_NICHE_TERMS.filter((term) =>
    includesTerm(haystack, term),
  );

  for (const category of CATEGORIES) {
    const matched = category.terms.filter((term) => includesTerm(haystack, term));
    if (matched.length > 0) {
      return {
        relevant: true,
        category: category.name,
        reason: `Matches the allowed ${category.name.toLowerCase()} universe`,
        matchedTerms: matched.slice(0, 5),
      };
    }
  }

  if (excluded.length > 0) {
    return {
      relevant: false,
      category: null,
      reason: "Matches an excluded off-niche topic",
      matchedTerms: excluded.slice(0, 5),
    };
  }

  const customMatches = profileTerms(context).filter((term) =>
    includesTerm(haystack, term),
  );
  if (customMatches.length > 0) {
    return {
      relevant: true,
      category: "Saved niche topic",
      reason: "Matches a topic or keyword saved in the niche profile",
      matchedTerms: customMatches.slice(0, 5),
    };
  }

  const queryMatches = queryTerms(query).filter((term) =>
    includesTerm(haystack, term),
  );
  if (queryMatches.length >= 2) {
    return {
      relevant: true,
      category: "Active niche query",
      reason: "Matches at least two specific terms from the active scan",
      matchedTerms: queryMatches.slice(0, 5),
    };
  }

  return {
    relevant: false,
    category: null,
    reason: "Outside the allowed student-tech/developer content universe",
    matchedTerms: [],
  };
}

export const formcraftCreatorUniverseTopics = CATEGORIES.map(
  (category) => category.name,
);
