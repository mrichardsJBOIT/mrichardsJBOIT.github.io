---
layout: post
title: "The model-ops programme, part 2: the number that changed the plan"
description: "The overnight test the last post promised: eight unseen tasks through the blind knowledge sheet, a cloud calibration lane through the same harness, and the morning the local model stepped out of the generation tier."
author: Mark Richards
date: 2026-09-10
---

The last post ended with a plan: eight held-out tasks through a blind, topic-keyed knowledge sheet, running overnight, and a cloud calibration lane in parallel — the same harness, a known model, measured against its own published leaderboard numbers.

All of it ran. All of it landed in the scoreboard. And one number changed the plan.

The full record is on the [Model Ops Lab project page](/projects/model-ops-lab/), with every figure sourced. This is the story, in my own words again.

<!--more-->

## The generalisation number

Eight tasks nobody had opened before the knowledge sheet was written — tasks the programme was never tuned against. First attempt each, with a survey that had to produce a work order before anything else could happen.

**1 of 8 passed.**

Over both rounds — one task's second attempts ran after the first were lost to a power adapter — it's 2 of 12, and the two passes are the same task, `ar-compact-positions`, which turned out to be a one-token typo. To be fair to the local model, that task is trivial — but that is precisely the point. The generalisation test was supposed to be the moment a real pass rate appeared. Instead we learned that 1 of 8 is what a 27B 4-bit model does on unseen work even with a curated sheet in front of it.

Only one survey stopped on its own. Every other plan came from forced emission — the harness asking for the plan when the survey hit its budget.

## The constraint is not the sheet

I wanted to know whether the sheet was doing the work, so the coverage check handed known misses their own facts. Three tasks whose exact missing fact was *in the sheet*: the model failed **0 of 3**.

When the fact was used, the judgement of where to apply it failed — it applied a savepoint rule to three jobs where the oracle sets two. The one pass in that queue came from a task whose fact the sheet didn't carry at all.

So the honest statement is the sharp one: **the sheet is real, and it is not the constraint.** A fact written blind from the changelogs did not convert a known miss on its own. The constraint is what it has been since the first boundary: process. The model doesn't stop; it loops on thin plans; it edits the right file the wrong way.

The miss classification made it countable: of 17 classified misses across two nights, **13 were process** — plan, behaviour, scope. Only 2 were knowledge, and both were general Active Record facts no changelog sheet would carry.

## The cloud lane

The control I'd been promising: deepseek-v4-flash-0731 — a model with **63 published upstream trials** on this exact leaderboard — through my phased harness, all 21 tasks, on a US$10 cap.

**10 of 20 graded, at $3.20.** Twenty to twenty-five minutes a run clean, against the local model's 57. And it matched its own profile: same outcome as upstream on 12 tasks, better on 2, worse on 1 — and that one was a plumbing loss, not a model result. Against three upstream trials apiece, our one-shot harness produced **no measurable lift and no measurable harm**.

Which means: the harness that couldn't rescue the local model is the harness I'd suspected was the problem all along. And the cloud model didn't need rescuing. It passed half its tasks at fifteen cents a run with no tuning.

## The screens

Three more local candidates, because if the 27B was the problem, maybe the problem was the 27B.

- A 30B MoE fine-tune aimed at Rails: **1 of 5**.
- A 40B "loop" model: **0 of 1**, writing its trained function-call syntax as text.
- Gemma 12B, the fastest local model we own: **0 of 5** — it investigates, finds the answer, and loses it on the way out. With reasoning off, it stopped on its own and named the typo line — then over-edited three files into a syntax error.

No local model rescues the tier. That question is closed.

## The decision

On the morning of 10 September the plan changed, deliberately and with the numbers on the table:

**The generation tier is now the cloud model.** The Macs stay — they are sunk, and they become free replication capacity for anything the harness discovers. And the harness work — stopping, orientation, phase B discipline, a proper verify queue — continues, but it's measured on the cloud model from here. That work is what the whole programme was really finding: the leverage is in the loop, and the loop is model-agnostic.

The programme moved the same morning to its new home, `avalon-speedway` — first commit clean, the migration reviewed, and the cutover run passed from the new tree. It was the first run in the programme to exercise phase C1 — the component that verifies the changed paths actually run — and it came up green.

What stands from the whole arc: the four-line stopping rule, the 1.6 KB verified sheet as a mechanism, per-attempt accounting, and the finding that prompt structure beats model choice. What changed: the local model's seat in the factory. Well-specified single-locus work can still go local. Everything else goes to the frontier — and the frontier is now the front line.

Be patient and persevere.

---

**Previous:** [The model-ops programme — what a 4-bit model on a laptop can actually do](/2026/09/09/model-ops-programme.html)