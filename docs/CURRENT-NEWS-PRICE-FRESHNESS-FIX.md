# Local current-news and current-price verification repair

October 3, 2026, America/Chicago. No commits, pushes or merges.

## Causes

The exact questions “What happened in Tulsa today?” and “What happened in Tulsa, OK today?” did reach the news route, but planner terms became mandatory headline constraints. The first plan required “local events” and “breaking news”; the second required “Tulsa Oklahoma”. A legitimate local headline need not contain those words or repeat the state, and often does not repeat the city. Planner-added calendar words also unnecessarily constrained upstream searches even though publication dates were already filtered separately.

A second problem surfaced during reproduction just after local midnight: the feeds successfully returned reports, but all were published on October 2 in America/Chicago. The code treated no matches for October 3 as an internet failure. Successful empty retrieval and failed network retrieval were indistinguishable.

The earlier price filter only excluded dated editorial sale reports older than 14 days. It did not apply consistently to plain price questions, accepted undated pages, and retained old search snippets and historical-price trackers. A current fetch timestamp was therefore mistaken for verification of the price itself. In the baseline live run, the Sony response mixed Amazon search text with a SoundGuys price from a July 9 article and Pangoly price history. The user's exact January article URL was not provided; a regression reproduces the reported January/$318.95 failure pattern. The specific older MacBook page was also not identified, so the same article-rejection rule covers it independently of URL or product name.

## Repair

News retrieval always includes the user's original topic alongside focused planner queries. Standard US state abbreviations are expanded generically when appropriate. Calendar annotations added by the planner are removed when date metadata already controls the search; explicit requested dates are retained. Requests run independently and merge/deduplicate results. The original geographic/topic feed does not require a city name in every headline; planner variants cannot enforce filler words absent from the user's actual topic. Exact publication-day filtering in the supplied timezone, future-date rejection and the existing alternate date-window retry remain in place.

A successful feed with no matching local-day reports returns an explicit checked-news outcome and the searched date. It never becomes “internet unavailable”, never implies nothing happened, and never presents yesterday's reports as today's events. Genuine upstream failures still fail with a retryable retrieval error.

News synthesis receives local publication dates rather than ambiguous UTC timestamps. Output checks reject invented dates, incorrect weekdays and use of a publication date as an event date. If the model adds unsupported calendar claims, the answer falls back to the retrieved headlines, phrased as recent reporting.

Current prices and sale status now require freshly retrieved **merchant listing evidence**, not an editorial report of any age. Readable Product/Offer metadata or structured live catalog cards establish exact product, currency and price. Editorial Article/NewsArticle/BlogPosting/document Review content is excluded even if it embeds Product markup; genuine products with customer reviews remain eligible. Expired offers, unreadable pages, unavailable offers, unrelated explicit model identifiers and cached page reads do not establish a current price. Direct article requests receive the same price gate when current pricing is requested.

The price gate runs for both web and news search results. Only verified offer rows reach local price synthesis; older excerpts, price-history text, financing copy and unrelated article bodies are removed. The local answer is checked for unsupported monetary amounts, model identifiers and unverified sale claims before display. Unsupported output uses the supplied live product facts. If no current merchant price is verified, the application replies directly: “I searched live sources, but could not verify a current retailer price or active sale.” It does not ask the model to guess a price from stale material.

Fresh-price follow-ups do not reuse stored evidence. Historical article follow-ups remain available. Article requests use Cache-Control: no-cache, and merchant page reads must be within five minutes of the search check. This verifies the publicly served listing, not a checkout guarantee or stock promise.

The successful weather path retains Open-Meteo and its freshness/unit checks. Current-weather output validation now prevents the local model from appending an unsupported next-day forecast during the control test. Amazon event-date research is explicitly distinct from current product-price verification; the date question continues to read its official announcement.

## Preservation

No model weights, Ollama configuration, LaunchAgent definitions, actual saved memories, saved location settings, chat storage schema, subscriptions or paid services were changed. No dependencies were added in this repair. The existing web service was restarted and the production client rebuilt; an open browser tab must reload. Offline/local paths, memory and provider startup are covered by the regression suite.

## Validation

Final live run: October 3, approximately 01:21–01:23 CDT. All nine cases invoked live retrieval and completed without retryable errors or false browsing refusals. The harness verifies routing and evidence delivery; the answers were also inspected for the reported failure patterns. The successful-empty and unverified-price outcomes deliberately bypass model synthesis instead of asking it to guess. Model synthesis received retrieved evidence for the Apple listing, weather, Amazon announcement and latest Tulsa headlines. Tests use actual free retrieval and the installed local Ollama model, with no question-specific routing or canned answers. Separate fixtures verify January and undated editorial rejection, expired/cached offers, genuine merchant listings with customer reviews, exact model selection, empty-day versus network failure, and valid local headlines lacking city/state/filler words.


| Live question | Observed result |
| --- | --- |
| What happened in Tulsa today? | Successful live feed check; no matching October 3 local-day reports yet. No claim that nothing happened. |
| What happened in Tulsa, OK today? | Same successful checked-news outcome; state spelling no longer blocks retrieval. |
| Give me the latest Tulsa local news. | Returned cold-front and Transformation Church conference headlines; unsupported model event-date claims were suppressed. |
| What is the current price of Sony WH-1000XM6 headphones right now? | Current merchant price could not be verified; no stale amount reported. |
| Are Sony WH-1000XM6 headphones on sale now? | Active sale could not be verified; no old editorial price reported. |
| What is the current price of a MacBook Air? | No readable offer established by these results; explicitly unverified. |
| How much is Apple asking for its entry-level MacBook Air right now? | Fresh official Apple product listings established M5, 16GB, 512GB at USD 1299. |
| What is the weather in Tulsa right now? | Current 62°F, feels like 60°F; no unsupported forecast appended. |
| When is Amazon having its Prime deal sales this October? | Official announcement established October 6–7, 2026; event-date retrieval preserved. |

The empty October 3 outcomes were verified against actual feeds: recent items were published October 2 or earlier in America/Chicago. This is a snapshot just after midnight, not a claim about the rest of the day. Fixtures additionally test successful retrieval of same-day local headlines without city/state names and distinguish successful empty results from upstream outages.

Automated regression suite: 163 passed, 27 opt-in cases skipped. Production TypeScript/Vite build passed; the existing bundle-size warning remains. `git diff --check` passed. Detailed, sanitized live evidence and answers are recorded in `CURRENT-NEWS-PRICE-FRESHNESS-RESULTS.json`.

Real local Ollama preservation checks: all four passed (streaming chat and context recall, cancellation followed by a fresh response, local reasoning, persisted-memory recall/edit/delete). Memory tests use isolated storage and do not touch saved user notes.
