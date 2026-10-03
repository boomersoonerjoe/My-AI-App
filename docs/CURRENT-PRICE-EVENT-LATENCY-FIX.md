# Current pricing, sale-event intent and latency repair

October 3, 2026. Local changes only; no commits, pushes or merges. No new dependencies or paid services.

## Reproduction and causes

The exact MacBook question returned the generic unverified-price response. The Apple family page supplies Schema.org AggregateOffer.lowPrice, not Offer.price. The extractor ignored it. Search relevance also rejected storefront snippets without visible price words; ranking favored dollar-bearing editorial snippets over actual purchase pages. Storefront descendant discovery additionally required the query to name the retailer's domain, so a product name alone could not trigger it.

The AirPods reproduction varied from the user's reported fallback: it reported USD 234 from pricehistory.app instead of a verified seller. Product/Offer metadata plus a /p/ path had been mistaken for a merchant listing, even though offeredBy identified a different seller. The corrected system rejects that tracker and discovers Apple's actual purchase page through generic product/official-store queries and storefront ranking.

The exact Amazon question returned the price-verification failure. The gate treated the word sales as a request for a product price, excluding event research only when question words such as when or dates appeared. General event announcements were also exposed to product-specific article-age and catalog-selection filters.

Latency had several independent causes: two focused search queries ran their engine groups sequentially; planning and evidence synthesis used different Ollama context capacities, causing repeated context reinitialization; synthesis carried unnecessary general instructions; all article reads were awaited even after sufficient preferred-store evidence was available. Official announcement headlines were stripped during readability extraction, causing early-completion checks to miss the year even when the live page title supplied it.

## Changes

- The existing local planner now identifies product-price, sale-event or other intent. The same validated intent travels through the client and search API to retrieval and synthesis. General retailer sale-event questions use announcement research, not product-price gates. Explicit price and product on-sale requests cannot bypass verification even if the planner misclassifies them. Historical queries retain their existing behavior.
- Product purchase queries include generic official-store research. Relevant storefronts need not display the amount in their search snippets; actual fetched listings establish it. Ranking favors purchase pages over editorial deal guides and trackers. Same-store product discovery no longer depends on a brand/domain word being present in the user's question.
- Merchant AggregateOffer.lowPrice is accepted as a **starting price**, with that qualification retained in evidence, model instructions, validation and fallback answers. This follows the [Schema.org AggregateOffer definition](https://schema.org/AggregateOffer). It does not establish every configuration's price or identify a particular base configuration.
- Editorial, expired, unreadable, unavailable, stale cached and model-mismatched pricing remains excluded. Metadata identifying a different seller, aggregate offers combining other sellers, malformed currency precision and generic /p/ tracker paths cannot establish a direct merchant price. Unverified searches still say so explicitly. The old January-price regression remains in the suite.
- Independent query groups now run concurrently with unchanged engine deadlines and result aggregation. A simple price question can finish after its preferred storefront supplies verified matching offers; comparison/cheapest requests still collect all reads. Failed preferred-store verification preserves fallback reads. A sale-event query can finish on a readable official-company announcement supporting the requested month and year; otherwise all fallback reads remain available. Unneeded reads are canceled.
- Live page titles are retained as evidence so announcement years discarded from article body extraction remain available. Unreadable pages cannot qualify merely through a search title.
- Planning and retrieved-answer generation share the existing 8192-token retrieval context capacity. Ordinary local chat remains at 4096. Price and sale-event synthesis use concise specialized instructions while retaining evidence-only and untrusted-text protections. No weights, global Ollama settings or autostart configuration changed.

## Validation

The full regression suite passed 174 tests, with 27 opt-in cases skipped. The production TypeScript/Vite build passed; the existing bundle-size warning remains. Live runs use the installed local Ollama model and actual free retrieval, not canned prices, dates or question-specific routing. Detailed evidence, answers and measured stages are stored in CURRENT-PRICE-EVENT-LATENCY-RESULTS.json.

One intermediate live run was interrupted by Mac sleep (confirmed in macOS power logs), producing invalid multi-minute timings and timeouts. It was excluded from latency comparisons. Subsequent test processes temporarily prevented idle sleep with caffeinate; no machine power settings were changed.

Final live results and preservation checks follow below.


| Exact question | Final live result | Total time |
| --- | --- | --- |
| How much is a MacBook Air right now? | Fresh Apple family listings: starts at USD 1299; 15-inch starts at USD 1499. No exact base configuration invented. | 12.0 s, including 7.4 s cold planner/model preparation |
| What’s the current price of AirPods Pro? | Fresh Apple listing: AirPods Pro 3 at USD 249. | 5.1 s |
| Is Amazon having any major sales this month? | Official Amazon announcement: Prime Big Deal Days, October 6–7, 2026. No product-price gate. | 8.0 s |

Additional final live controls: Tulsa current weather returned measured temperature/feels-like; the explicit Amazon October date question returned October 6–7; Tulsa current-news retrieval returned dated headlines; Sony on-sale-now remained unverified with no old amount repeated; a naturally worded Target sale-event question returned sale-event information without a price gate. All eight cases performed live retrieval and completed without retrieval errors or false browsing refusals. The three exact questions, weather, Amazon dates, news and Target answers received evidence in local model synthesis; the deliberately unverified Sony price outcome bypassed inference to prevent guessing.

Timing observations: baseline exact queries took 11.6 s (MacBook, unverified), 23.9 s (AirPods, tracker-derived price) and 16.3 s (Amazon, incorrect price-gate failure). In a warm corrected run, MacBook completed in 6.2 s; the final cold run was 12.0 s. AirPods and the general Amazon event question completed in 5.1 s and 8.0 s in the final run. The final explicit Amazon-date control was 8.5 s. Earlier runs of that control reached 21 s while waiting for unneeded page reads; the official-announcement early-completion path reduced that delay. Cold model loading, network variation, unavailable preferred pages and questions needing comparisons can still take longer. Search deadlines, offline safeguards and price evidence standards were not shortened to obtain these numbers.

No real saved location, notes, conversation data, LaunchAgent definitions, model weights or Ollama daemon configuration was modified. The web service was reloaded, and the client was rebuilt; reload an existing NhomeAI tab to use the new client. No dependencies or paid services were added. `git diff --check` passed.

Final real-Ollama preservation checks: all four passed—streaming/context recall, cancellation followed by a fresh response, local reasoning, and persisted-memory recall/edit/delete. These use isolated memory fixtures and do not alter real saved notes.
