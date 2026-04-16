'use strict';

/**
 * search.service.js — Web search integration for StudyTrack.
 *
 * Currently returns mock data.  Replace `_realSearch` with a concrete
 * implementation (Brave Search API, Serper, etc.) when ready.
 *
 * @param {string} query - The search query string
 * @returns {Promise<Array<{title:string, url:string, snippet:string}>>}
 */
async function searchWeb(query) {
  // TODO: replace with real web search API call
  console.log(`[search.service] searchWeb called (mock) — query: "${query}"`);

  return [
    {
      title: `[MOCK] Introduction to ${query}`,
      url: 'https://example.com/mock-result-1',
      snippet: `This is a mock search result for "${query}". Integrate a real search API to get live results.`,
    },
    {
      title: `[MOCK] Advanced guide: ${query}`,
      url: 'https://example.com/mock-result-2',
      snippet: `Another mock result covering advanced aspects of "${query}".`,
    },
  ];
}

module.exports = { searchWeb };
