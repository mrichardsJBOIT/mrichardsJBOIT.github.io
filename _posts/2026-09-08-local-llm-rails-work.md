---
layout: post
title: "Trying to make a local LLM do Rails work"
description: "Six months of benchmarking local models against a Rails dev-agent benchmark — the retrieval layer I built, the runs that failed, and the four lines of prompt that finally worked."
author: Mark Richards
date: 2026-09-08
---

I spent the last while trying to answer a simple question: can a model running on my own hardware do real Rails dev-agent work, if I hand it the right documentation?

The short answer: sometimes. And the journey there taught me more about benchmarking than about models.

<!--more-->

## The starting idea

The thesis was that local models could do accurate, timely Rails work — *if* a RAG layer injected the right docs at the right moment. I'd seen hand-picked doc excerpts lift every local model I tried to a perfect score on a recall harness. Those were ceiling tests — they measured what a *human* retriever could achieve, not a real system.

So I built the retrieval layer properly. Extracted a corpus from the pinned Rails 8 container image, tiered it, hybrid dense + lexical retrieval, RRF fusion, the works.

Real retrieval reached about 56% recall at rank 5. The oracle's ceiling had been 100%.

## What the A/B actually measured

Six agentic trials ran. Zero solved. Every one killed by the wall clock.

That's when I stopped trusting the scoreboard and started reading the transcripts. Across all six runs, the agent used `bash` and *nothing else*. Zero edit calls. In the worst case, it ran a probe at step 17, got the answer it needed, and re-ran that identical probe **61 more times**.

The failure wasn't knowledge acquisition. It was converting a known answer into an edit.

## The control that changed my mind

I ran an Opus model through the same harness — no docs at all — and it passed the task first try. Then I ran a matched pair with and without RAG on a harder task: both failed with byte-identical diffs. The RAG made zero difference.

The models weren't failing because they didn't know the API. They were failing on judgement — one even identified the second bug in its uncertainty notes, then scoped it out as a "pre-existing upstream quirk." Documentation doesn't fix a judgement call.

## The four lines that finally worked

The breakthrough came from a completely different angle: a stopping rule.

> *Investigate for at most 10 tool calls, then make your edit. If you are still uncertain after that, implement your best solution anyway and verify it by running `bin/rails test` — do not keep investigating instead of deciding. You must leave a change on disk.*

Same model, same harness, same everything — 28 calls instead of 87, three edits, finished in 21 minutes, and it **stopped voluntarily**. The first local run in the whole programme to judge itself done; all nine before it were killed by the clock.

It also routed around its own knowledge gap — it never found Rails 8's `rate_limit` API, so it hand-rolled a mutex-guarded sliding window instead. For that task, the missing training data simply wasn't the constraint.

## The boundary

Then I ran it overnight on harder tasks, seven runs, each with a different intervention on top of the stopping rule. One task passed a third time — with a *different* solution than the two earlier passes, so it was re-deriving, not memorising. Everything else failed.

The honest read: repetition is the discriminator. The failures ran 20–82% duplicate tool calls; the passes ran 0%. Four prompt interventions failed to move that needle. One "definition of done" prompt made the model act — then it monkey-patched the removed API back globally and broke the app's own test suite. Instructing for completeness without constraining method produces sweeping wrong changes.

## What I'd do differently

The best lessons were the embarrassing ones:

- I A/B-tested a task that 15 of 18 frontier models also score zero on. Filter tasks by pass rate first, retrieval rank second.
- I claimed the tool-case patch shipped when it hadn't. Verify inside the container the runner actually uses.
- I trusted a health metric that only ever improved — it was hashing truncated command strings and hiding a 47× duplicate. Measure repetition on full arguments.
- I wrote a strategic conclusion into the index hours before a second task buried it. One pass on one easy task is a lead, not a finding.

## Where it landed

The strategic consequence is actually encouraging: the factory is viable on hardware I already own. The lever isn't more docs or a better model — it's prompt and loop design, which is the cheapest lever of all.

The caveat is the n=1. One pass on one easy task, even replicated three times with different solutions, is a lead. The overnight runs drew the boundary. That's how it goes: you find the thing that works, then you find out exactly how narrow it is.

Be patient and persevere.