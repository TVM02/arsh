const normalize = (value) =>
  value === null || value === undefined
    ? ""
    : String(value).toLowerCase().trim().replace(/\s+/g, " ");

const compact = (value) => normalize(value).replace(/[^a-z0-9]/g, "");

const getWords = (value) => normalize(value).split(/[\s\-_/.,()]+/).filter(Boolean);

export const getSearchRank = (value, search, keywords = []) => {
  const searchText = normalize(search);
  if (!searchText) return 1;

  const candidates = [value, ...keywords]
    .map((candidate) => normalize(candidate))
    .filter(Boolean);

  if (candidates.length === 0) return 0;

  const searchTokens = searchText.split(" ").filter(Boolean);
  const compactSearch = compact(searchText);
  const matchesAllTokens = searchTokens.every((token) => {
    const compactToken = compact(token);
    return candidates.some(
      (candidate) =>
        candidate.includes(token) ||
        (compactToken && compact(candidate).includes(compactToken)),
    );
  });

  if (!matchesAllTokens) return 0;

  let bestRank = 1;

  candidates.forEach((candidate) => {
    const candidateCompact = compact(candidate);
    const words = getWords(candidate);

    if (candidate === searchText) bestRank = Math.max(bestRank, 1000);
    if (compactSearch && candidateCompact === compactSearch) {
      bestRank = Math.max(bestRank, 980);
    }
    if (candidate.startsWith(searchText)) bestRank = Math.max(bestRank, 900);
    if (compactSearch && candidateCompact.startsWith(compactSearch)) {
      bestRank = Math.max(bestRank, 880);
    }
    if (words.some((word) => word === searchText)) {
      bestRank = Math.max(bestRank, 820);
    }
    if (words.some((word) => word.startsWith(searchText))) {
      bestRank = Math.max(bestRank, 760);
    }
    if (candidate.includes(searchText)) bestRank = Math.max(bestRank, 620);
    if (compactSearch && candidateCompact.includes(compactSearch)) {
      bestRank = Math.max(bestRank, 600);
    }
  });

  return bestRank;
};

export const sortBySearchRank = (items, search, getSearchText, getKeywords) =>
  items
    .map((item, index) => ({
      item,
      index,
      rank: getSearchRank(
        getSearchText(item),
        search,
        getKeywords ? getKeywords(item) : [],
      ),
    }))
    .filter(({ rank }) => rank > 0)
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map(({ item }) => item);
