---
layout: post
title: "The model-ops programme: what a 4-bit model on a laptop can actually do"
description: "Fifteen days of measuring a local coding agent against a real Rails benchmark — the retrieval layer that didn't matter, the four lines of prompt that did, and the 1.6 KB knowledge sheet that closed the last gap."
author: Mark Richards
date: 2026-09-09
---

I've been running an evaluation programme against the [rails/ai-evals](https://github.com/rails/ai-evals) benchmark — 21 real Rails tasks, each a seeded defect in Writebook with a hidden test, measured against 1,170 published upstream trials. The question was never "can a frontier model do this" — that's answered, and it costs per token. The question was whether a local model on my own hardware, wrapped in the right structure, clears a bar that the same model without that structure does not.

The full write-up lives on the [Model Ops Lab project page](/projects/model-ops-lab/), with every figure sourced. This post is the story in my own words.

> **Update, 10 September — [the number that changed the plan](/2026/09/10/model-ops-programme-part-2.html).** The overnight test came back 1 of 8 on unseen tasks, the sheet's own facts did not convert known misses, a cloud lane through the same harness passed 10 of 20 at $3.20 — and the generation tier moved to the cloud. The local model stays on as free replication capacity.

<!--more-->

## The idea that didn't survive contact

The original thesis: local models can do accurate, timely Rails work *if* a RAG layer injects the right docs at dispatch. I'd seen hand-picked doc excerpts lift every local model to a perfect score on a recall harness — but those were ceiling tests, measuring what a human retriever could achieve, not a real system.

I built the retrieval layer properly anyway: corpus extracted from the pinned Rails 8 container image, hybrid dense + lexical retrieval, RRF fusion, LLM query expansion. Real retrieval reached about 56% recall at rank 5. The ceiling had been 100%.

The agentic A/B measured nothing: six trials, zero solved, every one killed by the wall clock. And the forensics were worse — across all six runs the agent used `bash` and nothing else. Zero edit calls. The worst case received the correct answer from a probe at step 17 and re-ran that identical probe **61 more times**. The failure was never knowledge acquisition. It was converting a known answer into an edit.

## The four lines that changed everything

The breakthrough came from the cheapest possible intervention: a stopping rule.

> *Investigate for at most 10 tool calls, then make your edit. If you are still uncertain after that, implement your best solution anyway and verify it by running `bin/rails test` — do not keep investigating instead of deciding. You must leave a change on disk.*

Same model, same harness, same everything. 28 calls instead of 87. Three edits. Finished in 21 minutes, and it **stopped voluntarily** — the first local run in the whole programme to judge itself done; all nine before it were killed by the clock. It also routed around its own knowledge gap: never found Rails 8's `rate_limit` API, so it hand-rolled a mutex-guarded sliding window. The verifier checks behaviour, so it passed.

That task — `ac-throttle-search` — passed three times, with a *different implementation each time*. It was re-deriving the fix, not reproducing a memorised one.

## The boundary

Then I ran it overnight on harder tasks. Everything multi-locus failed: 0-for-6. A "definition of done" addition made it worse — the model acted decisively and wrong, monkey-patching the removed API back globally and breaking the app's own test suite. Instructing for completeness without constraining method produces sweeping wrong changes.

Three more things worth stating plainly:

**Static scores didn't predict agentic ability.** The model that scored 95/100 on a single-turn rubric was dead last on baseline API recall, and hallucinated another vendor's tool names in the live harness.

**Local inference isn't slow — the adapter was.** Same weights, same server: 41–48 s/step through one provider path, 22.0 s/step through another. Faster than the cloud run that passed. It also exposed a fairness bug: the benchmark's step limit and wall clock bind differently for fast and slow models, so earlier cloud-vs-local comparisons were never like-for-like.

**RAG is narrow, and general RAG was the wrong delivery.** The properly controlled pair on Opus was a clean null — plain and RAG arms produced byte-identical diffs and failed the same hidden test. Both runs *saw* the second bug in their uncertainties and reasoned themselves out of fixing it. That's a judgement failure, and no documentation fixes a judgement call.

## The 1.6 KB sheet

The task I'd struggled with for a day (`sup-legacy-conversions`, 0-for-6 locally) turned on one fact: Rails 7.0 renamed `to_s(:format)` to `to_fs(:format)` rather than removing it. I wrote a 1.6 KB sheet of verified Rails upgrade notes — every entry checked with `bin/rails runner`, nothing recalled from memory — and handed it to the survey phase. First attempt: pass, with a diff **byte-identical to the oracle patch**.

The placebo control confirmed the mechanism: same-size sheet with the decisive facts removed, 0 of 2. The sheet works by the specific facts it carries, including the less obvious ones. Small, exact, verified context beats big retrieved context every time — and it costs nothing to produce for upgrade-shaped work, because it's derivable from release notes.

## Where it landed

The honest numbers, per attempt: 2 passes from 8 attempts on that arm. Phase A — the read-only survey that writes the work order — produced nothing in 8 of 10 attempts on the bad day. It doesn't loop; it fails to converge. That's now the open question, and the measured answer so far is that a call cap and forced emission fix it: 3 of 3 graded runs passed on the first attempt once the harness stopped waiting for the model to decide it was done.

For the software factory this is genuinely encouraging: the routing rule now has numbers behind it. Well-specified single-locus work can go local today. Multi-locus work goes local only with a curated knowledge sheet and a survey phase that finishes. Everything else goes to the frontier. And the cheapest levers — prompt design, loop design, a curated sheet — turned out to be the ones that moved the needle, not model shopping.

The programme has moved to its own repo and keeps running — mostly overnight, while I sleep. (It's not public yet — the migration plan for a public version, codenamed "avalon", is drafted.)

Be patient and persevere.

---

**Next:** [The model-ops programme, part 2 — the number that changed the plan](/2026/09/10/model-ops-programme-part-2.html) — the overnight test, the cloud lane, and the pivot.