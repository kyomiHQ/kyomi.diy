import { interestBundles, type StarterBundle } from "./interest-bundles";

export const starterBundleLimit = 6;

const coreBundles = [
  {
    id: "technology",
    title: "Technology",
    description: "Software & digital rights",
    interests: ["Technology", "Software Engineering", "Security & Privacy"],
    feeds: [
      {
        title: "Ars Technica",
        url: "https://feeds.arstechnica.com/arstechnica/index",
        siteUrl: "https://arstechnica.com",
      },
      {
        title: "The Cloudflare Blog",
        url: "https://blog.cloudflare.com/rss/",
        siteUrl: "https://blog.cloudflare.com",
      },
      {
        title: "The GitHub Blog",
        url: "https://github.blog/feed/",
        siteUrl: "https://github.blog",
      },
      {
        title: "EFF Updates",
        url: "https://www.eff.org/rss/updates.xml",
        siteUrl: "https://www.eff.org",
      },
    ],
  },
  {
    id: "science",
    title: "Science",
    description: "Physics, space & life",
    interests: ["Science & Research", "Climate & Environment", "Health & Medicine"],
    feeds: [
      {
        title: "Quanta Magazine",
        url: "https://www.quantamagazine.org/feed/",
        siteUrl: "https://www.quantamagazine.org",
      },
      {
        title: "Science News",
        url: "https://www.sciencenews.org/feed",
        siteUrl: "https://www.sciencenews.org",
      },
      {
        title: "NASA",
        url: "https://www.nasa.gov/feed/",
        siteUrl: "https://www.nasa.gov",
      },
      {
        title: "ScienceDaily",
        url: "https://www.sciencedaily.com/rss/top/science.xml",
        siteUrl: "https://www.sciencedaily.com",
      },
    ],
  },
  {
    id: "design",
    title: "Design",
    description: "Web design & usability",
    interests: ["Design & UX", "Technology", "Culture & Media"],
    feeds: [
      {
        title: "A List Apart",
        url: "https://alistapart.com/main/feed",
        siteUrl: "https://alistapart.com",
      },
      {
        title: "Smashing Magazine",
        url: "https://www.smashingmagazine.com/feed",
        siteUrl: "https://www.smashingmagazine.com",
      },
      {
        title: "Nielsen Norman Group",
        url: "https://www.nngroup.com/feed/rss",
        siteUrl: "https://www.nngroup.com",
      },
      {
        title: "Fast Company Design",
        url: "https://www.fastcompany.com/section/design/rss",
        siteUrl: "https://www.fastcompany.com",
      },
    ],
  },
  {
    id: "climate",
    title: "Climate & environment",
    description: "Climate policy",
    interests: ["Climate & Environment", "Science & Research", "Politics & Policy"],
    feeds: [
      {
        title: "Carbon Brief",
        url: "https://www.carbonbrief.org/feed",
        siteUrl: "https://www.carbonbrief.org",
      },
      {
        title: "Grist",
        url: "https://grist.org/feed",
        siteUrl: "https://grist.org",
      },
      {
        title: "Inside Climate News",
        url: "https://insideclimatenews.org/feed",
        siteUrl: "https://insideclimatenews.org",
      },
      {
        title: "Climate Home News",
        url: "https://www.climatechangenews.com/feed",
        siteUrl: "https://www.climatechangenews.com",
      },
    ],
  },
  {
    id: "culture",
    title: "Arts & culture",
    description: "Books, ideas & media",
    interests: ["Culture & Media", "Personal & Essays"],
    feeds: [
      {
        title: "Literary Hub",
        url: "https://lithub.com/feed",
        siteUrl: "https://lithub.com",
      },
      {
        title: "The Paris Review",
        url: "https://www.theparisreview.org/blog/feed",
        siteUrl: "https://www.theparisreview.org",
      },
      {
        title: "Open Culture",
        url: "https://www.openculture.com/feed",
        siteUrl: "https://www.openculture.com",
      },
      {
        title: "Nieman Lab",
        url: "https://www.niemanlab.org/feed",
        siteUrl: "https://www.niemanlab.org",
      },
    ],
  },
  {
    id: "business",
    title: "Tech & business",
    description: "Startups & platforms",
    interests: ["Business & Startups", "Technology", "Finance & Markets"],
    feeds: [
      {
        title: "Stratechery",
        url: "https://stratechery.com/feed",
        siteUrl: "https://stratechery.com",
      },
      {
        title: "SaaStr",
        url: "https://www.saastr.com/feed",
        siteUrl: "https://www.saastr.com",
      },
      {
        title: "Platformer",
        url: "https://www.platformer.news/rss",
        siteUrl: "https://www.platformer.news",
      },
      {
        title: "O’Reilly Radar",
        url: "https://www.oreilly.com/radar/feed",
        siteUrl: "https://www.oreilly.com",
      },
    ],
  },
] as const satisfies readonly StarterBundle[];

// Shared feed catalog for onboarding and its browser preview.
export const starterBundles = [...coreBundles, ...interestBundles] as const;

export type StarterBundleId = (typeof starterBundles)[number]["id"];

/**
 * Picks the bundles shown in onboarding: one per chosen interest first, in the order the
 * reader chose them, then the closest neighbours, then catalog order to fill the list.
 */
export function recommendStarterBundles(interests: readonly string[], limit = starterBundleLimit) {
  function score(bundle: (typeof starterBundles)[number]) {
    return interests.reduce((total, interest, rank) => {
      const position = (bundle.interests as readonly string[]).indexOf(interest);
      if (position === 0) return total + 100 - rank;
      return position > 0 ? total + 10 - position : total;
    }, 0);
  }

  return starterBundles
    .map((bundle, index) => ({ bundle, index, score: score(bundle) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ bundle }) => bundle);
}
