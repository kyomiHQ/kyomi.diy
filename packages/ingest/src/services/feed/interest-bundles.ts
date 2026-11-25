import type { CANONICAL_CATEGORY_LABELS } from "@kyomi/db";

export type InterestLabel = (typeof CANONICAL_CATEGORY_LABELS)[number];

export type StarterBundle = {
  id: string;
  title: string;
  description: string;
  /** The first entry is the interest this bundle answers; the rest are near neighbours. */
  interests: readonly [InterestLabel, ...InterestLabel[]];
  feeds: readonly { title: string; url: string; siteUrl: string }[];
};

// One bundle per remaining onboarding interest; the core six live in starter-bundles.ts.
export const interestBundles = [
  {
    id: "ai",
    title: "AI & machine learning",
    description: "Models & tools",
    interests: ["AI & ML", "Software Engineering", "Science & Research"],
    feeds: [
      {
        title: "Simon Willison",
        url: "https://simonwillison.net/atom/everything/",
        siteUrl: "https://simonwillison.net",
      },
      {
        title: "Hugging Face Blog",
        url: "https://huggingface.co/blog/feed.xml",
        siteUrl: "https://huggingface.co/blog",
      },
      {
        title: "Google DeepMind",
        url: "https://deepmind.google/blog/rss.xml",
        siteUrl: "https://deepmind.google",
      },
      {
        title: "Import AI",
        url: "https://importai.substack.com/feed",
        siteUrl: "https://importai.substack.com",
      },
    ],
  },
  {
    id: "engineering",
    title: "Software engineering",
    description: "Systems & code",
    interests: ["Software Engineering", "AI & ML", "Technology"],
    feeds: [
      {
        title: "Martin Fowler",
        url: "https://martinfowler.com/feed.atom",
        siteUrl: "https://martinfowler.com",
      },
      {
        title: "The Pragmatic Engineer",
        url: "https://newsletter.pragmaticengineer.com/feed",
        siteUrl: "https://newsletter.pragmaticengineer.com",
      },
      {
        title: "Julia Evans",
        url: "https://jvns.ca/atom.xml",
        siteUrl: "https://jvns.ca",
      },
      {
        title: "Dan Luu",
        url: "https://danluu.com/atom.xml",
        siteUrl: "https://danluu.com",
      },
    ],
  },
  {
    id: "security",
    title: "Security & privacy",
    description: "Breaches & scams",
    interests: ["Security & Privacy", "Technology", "Politics & Policy"],
    feeds: [
      {
        title: "Krebs on Security",
        url: "https://krebsonsecurity.com/feed/",
        siteUrl: "https://krebsonsecurity.com",
      },
      {
        title: "Schneier on Security",
        url: "https://www.schneier.com/feed/atom/",
        siteUrl: "https://www.schneier.com",
      },
      {
        title: "The Record",
        url: "https://therecord.media/feed",
        siteUrl: "https://therecord.media",
      },
      {
        title: "Troy Hunt",
        url: "https://www.troyhunt.com/rss/",
        siteUrl: "https://www.troyhunt.com",
      },
    ],
  },
  {
    id: "finance",
    title: "Finance & markets",
    description: "Markets & growth",
    interests: ["Finance & Markets", "Business & Startups", "Politics & Policy"],
    feeds: [
      {
        title: "Marginal Revolution",
        url: "https://marginalrevolution.com/feed",
        siteUrl: "https://marginalrevolution.com",
      },
      {
        title: "Calculated Risk",
        url: "https://www.calculatedriskblog.com/feeds/posts/default",
        siteUrl: "https://www.calculatedriskblog.com",
      },
      {
        title: "Abnormal Returns",
        url: "https://abnormalreturns.com/feed/",
        siteUrl: "https://abnormalreturns.com",
      },
      {
        title: "The Big Picture",
        url: "https://ritholtz.com/feed/",
        siteUrl: "https://ritholtz.com",
      },
    ],
  },
  {
    id: "politics",
    title: "Politics & policy",
    description: "Elections & courts",
    interests: ["Politics & Policy", "World & Society"],
    feeds: [
      {
        title: "ProPublica",
        url: "https://feeds.propublica.org/propublica/main",
        siteUrl: "https://www.propublica.org",
      },
      {
        title: "NPR Politics",
        url: "https://feeds.npr.org/1014/rss.xml",
        siteUrl: "https://www.npr.org/sections/politics",
      },
      {
        title: "Politico",
        url: "https://rss.politico.com/politics-news.xml",
        siteUrl: "https://www.politico.com",
      },
      {
        title: "SCOTUSblog",
        url: "https://www.scotusblog.com/feed/",
        siteUrl: "https://www.scotusblog.com",
      },
    ],
  },
  {
    id: "world",
    title: "World news",
    description: "Reporting across borders",
    interests: ["World & Society", "Politics & Policy", "Climate & Environment"],
    feeds: [
      {
        title: "BBC News World",
        url: "https://feeds.bbci.co.uk/news/world/rss.xml",
        siteUrl: "https://www.bbc.com/news/world",
      },
      {
        title: "DW News",
        url: "https://rss.dw.com/rdf/rss-en-all",
        siteUrl: "https://www.dw.com",
      },
      {
        title: "Al Jazeera",
        url: "https://www.aljazeera.com/xml/rss/all.xml",
        siteUrl: "https://www.aljazeera.com",
      },
      {
        title: "NPR World",
        url: "https://feeds.npr.org/1004/rss.xml",
        siteUrl: "https://www.npr.org/sections/world",
      },
    ],
  },
  {
    id: "health",
    title: "Health & medicine",
    description: "Studies & care",
    interests: ["Health & Medicine", "Science & Research"],
    feeds: [
      {
        title: "STAT",
        url: "https://www.statnews.com/feed/",
        siteUrl: "https://www.statnews.com",
      },
      {
        title: "KFF Health News",
        url: "https://kffhealthnews.org/feed/",
        siteUrl: "https://kffhealthnews.org",
      },
      {
        title: "NPR Health",
        url: "https://feeds.npr.org/1128/rss.xml",
        siteUrl: "https://www.npr.org/sections/health",
      },
      {
        title: "Science-Based Medicine",
        url: "https://sciencebasedmedicine.org/feed/",
        siteUrl: "https://sciencebasedmedicine.org",
      },
    ],
  },
  {
    id: "work",
    title: "Education & work",
    description: "Schools & careers",
    interests: ["Education & Work", "Personal & Essays", "Business & Startups"],
    feeds: [
      {
        title: "Cal Newport",
        url: "https://calnewport.com/feed/",
        siteUrl: "https://calnewport.com",
      },
      {
        title: "The Hechinger Report",
        url: "https://hechingerreport.org/feed/",
        siteUrl: "https://hechingerreport.org",
      },
      {
        title: "EdSurge",
        url: "https://www.edsurge.com/articles_rss",
        siteUrl: "https://www.edsurge.com",
      },
      {
        title: "Inside Higher Ed",
        url: "https://www.insidehighered.com/rss.xml",
        siteUrl: "https://www.insidehighered.com",
      },
    ],
  },
  {
    id: "sports",
    title: "Sports",
    description: "Scores, analysis & opinion",
    interests: ["Sports"],
    feeds: [
      {
        title: "BBC Sport",
        url: "https://feeds.bbci.co.uk/sport/rss.xml",
        siteUrl: "https://www.bbc.com/sport",
      },
      {
        title: "ESPN",
        url: "https://www.espn.com/espn/rss/news",
        siteUrl: "https://www.espn.com",
      },
      {
        title: "Sky Sports",
        url: "https://www.skysports.com/rss/12040",
        siteUrl: "https://www.skysports.com",
      },
      {
        title: "Defector",
        url: "https://defector.com/feed",
        siteUrl: "https://defector.com",
      },
    ],
  },
  {
    id: "food-travel",
    title: "Food & travel",
    description: "Recipes & places",
    interests: ["Food & Travel", "Culture & Media"],
    feeds: [
      {
        title: "Eater",
        url: "https://www.eater.com/rss/index.xml",
        siteUrl: "https://www.eater.com",
      },
      {
        title: "Smitten Kitchen",
        url: "https://smittenkitchen.com/feed/",
        siteUrl: "https://smittenkitchen.com",
      },
      {
        title: "Atlas Obscura",
        url: "https://www.atlasobscura.com/feeds/latest",
        siteUrl: "https://www.atlasobscura.com",
      },
      {
        title: "Condé Nast Traveler",
        url: "https://www.cntraveler.com/feed/rss",
        siteUrl: "https://www.cntraveler.com",
      },
    ],
  },
  {
    id: "essays",
    title: "Essays & ideas",
    description: "Culture & creativity",
    interests: ["Personal & Essays", "Culture & Media", "Education & Work"],
    feeds: [
      {
        title: "Aeon",
        url: "https://aeon.co/feed.rss",
        siteUrl: "https://aeon.co",
      },
      {
        title: "The Marginalian",
        url: "https://www.themarginalian.org/feed/",
        siteUrl: "https://www.themarginalian.org",
      },
      {
        title: "kottke.org",
        url: "https://feeds.kottke.org/main",
        siteUrl: "https://kottke.org",
      },
      {
        title: "Austin Kleon",
        url: "https://austinkleon.com/feed/",
        siteUrl: "https://austinkleon.com",
      },
    ],
  },
] as const satisfies readonly StarterBundle[];
