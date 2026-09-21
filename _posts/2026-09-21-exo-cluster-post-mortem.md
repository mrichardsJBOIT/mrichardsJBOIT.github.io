---
layout: post
title: "Nine days, three Macs, zero files: my Thunderbolt AI cluster post-mortem"
description: "I spent nine days and $2,400 of hardware trying to shard LLMs across three Macs over Thunderbolt. The machines never even got hot — the software ate itself. Here's the forensic record, and the pivot it forced."
author: Mark Richards
date: 2026-09-21
---

I have three Apple Silicon Macs sitting in my office. Two of them are M1 Max MacBook Pros — $2,400 of compute each — and for a while I was convinced they were idle hardware I wasn't getting value from.

So I set out to build the thing every local-AI enthusiast is building right now: a **distributed inference cluster**. Three Macs linked by Thunderbolt, running [exo](https://github.com/exo-explore/exo) to shard models too big for any single machine — pipeline-parallel across the desk, no cloud, total control.

Nine days later I had a 938-line forensic report, two upstream bug patches, a crash that wasn't what it looked like, and **zero HTML files** to show for the big test run. The machines never thermally stalled once. The software ate itself.

This is the post-mortem — the receipts, the crash that wasn't overheating, and the boundary it drew between what local AI can and can't do.

<!--more-->

## The dream (and the $2,400 problem)

The pitch writes itself: you already own the hardware. Add a Thunderbolt cable, run exo's peer-to-peer sharding, and a 51 GB model that won't fit one Mac runs across two of them like it was nothing. No API bills. Data never leaves the room.

The topology: an M4 Mac Mini as the hub, two M1 Max MacBook Pros hanging off it via TB4 bridges, and my always-on M1 Mac Mini as the gateway. Total: **144 GB of RAM and three Macs that were "idle."**

## Act one: getting it to converge

**Day 1 — headless failed before it started.** I tried running the nodes as headless servers. macOS TCC (the privacy-consent framework) quietly killed it: Metal GPU access and Local Network multicast permissions need a GUI session to approve them, and `uv`'s changing Python binaries silently revoked grants on every install. True headless MLX on macOS is impractical unless Apple ships a signed launcher — which it doesn't. Shelved inside a day.

**Day 2 — the cluster converged, after I fixed someone else's bugs.** exo discovers nodes over a custom IPv6 multicast group (`ff12::e0a1:de89`), not mDNS. Two bugs in its `discovery.rs`: a `swap_remove` that drains the announce list whenever it hits a transient `EHOSTUNREACH` (upstream issue [#2191](https://github.com/exo-explore/exo) — routine on wake, WiFi flap, or TB renegotiation), and a second bug where the announce list was born empty during boot interface churn and never recovered. I patched in a `resync_ifaces()` self-heal. Three nodes converged. I felt like a systems engineer.

**Day 3 — first sharded inference: 2.21 seconds.** We shared models over NFS (229 MB/s over TB once I fixed the export rule — 28× the WiFi path) and ran a small 8B model pipeline-split across two laptops. It worked. That was the high tide.

## The numbers that should have ended it sooner

I ran the systematic benchmarks. They were damning, and I kept going anyway.

| Model | Single node | 2-node pipeline | Relative |
|---|---|---|---|
| Qwen3-8B (8.1 GB, 36 layers) | 4.31 tok/s | 5.05 tok/s | **+17%** |
| Qwen3.8-27B-4bit (15 GB, 64 layers) | 7.4 tok/s | ~2.4 tok/s | **−68%** |
| Qwen3.8-27B-bf16 (51 GB, 64 layers) | doesn't fit | **1.42 tok/s** | Required |

The 51 GB model — the whole reason to cluster — ran at **1.42 tokens per second**. A hundred seconds to decode one sentence. The pipeline bubble: rank 0 at 91.7% CPU, rank 1 idle at 20.5%, hidden-state transfers using **0.001% of the Thunderbolt bandwidth**. Prefill parallelised; decode serialised — a 100:1 ratio baked into the architecture. The network was never the bottleneck. Compute was.

And the killer finding: **clustering made every model that fit one machine slower** — except the 8B, which gained a pointless 17% up to a blistering 5 tokens/s. For models that fit, one machine wins. For the model that didn't fit, the cluster made it unusable anyway.

## The crash that wasn't overheating

Day 6, a warm Melbourne afternoon. Sustained inference, a long OpenCode build task, and the cluster collapsed. Both MacBooks dropped off; the task hung for **16 hours**; when I aborted it, **zero files had been written** — just an empty directory.

The circumstantial case for overheating was compelling. It was wrong.

Rotated logs: **52,220 clock-skew rejections** in sixteen minutes — every message from MBP-16 dropped because its clock was **1.4 seconds ahead** of the hub's (tolerance: 500 ms). The TB-only topology I'd built the day before — no WiFi on any node, remember — meant **no NTP source**. The cluster wasn't thermal; it was temporal. I fixed it with chronyd and a dnsmasq NAT so the TB-only machines could reach the internet at all.

That's the detail that makes this worth publishing: the failure was *configuration* — my configuration, my topology decision — wearing a disguise convincing enough that even I blamed the hardware first.

## The independent verdict

I brought in an external analyst (Billy Richards, working with Claude) to look at everything cold. The verdicts that mattered:

> **"The test case indicts the topology, not the network."** A 26B model at 8-bit is ~26 GB. It fits one 64 GB M1 Max. Clustering it pays full pipeline-hop tax for zero capacity benefit.

> **"2 minutes vs. 3 hours and zero files isn't a tuning problem — it's a decisive result."**

And the rule that should have been my first principle: **node count = ⌈model size / 64 GB⌉** — never "however many machines happen to be on the desk."

## What survived the wreck

The cluster is decommissioned. But the week wasn't wasted — it produced the map of what local inference is *actually* good at:

- **Single-node MoE models are fast.** KAT-Coder-V2.5: **~60 tok/s**. Gemma-4-e4b: **58.4 tok/s**. A 3B-active MoE on an M1 Max keeps up with interactive use. Architecture eats parameter count for breakfast — the same lesson my [model-ops programme](/2026/09/09/model-ops-programme.html) later proved from the other direction.
- **Fan-out beats fan-in.** For batch work, split the data across N independent single-node instances. One node dying loses only its slice. No network layer in the critical path.
- **Cloud wins agentic work. Decisively.** Even on the 60 tok/s nodes, coding agents need interactivity and multi-turn coherence that local models on this hardware don't clear — a finding my subsequent benchmark work kept confirming.

## The pivot: the software factory

The economic math landed at the same place. August's OpenRouter spend: **~$101 USD**, with a single model (Kimi K3) eating $52 of it. Claude Co Work at $200/mo didn't save money *or* keep capabilities. The configuration that won:

```
Claude Pro ($20/mo) ─ writes specs, architectures, test cases
        │
   OpenClaw (orchestrator)
        ├── Cloud API model (cheap flash)  → chat, complex reasoning
        └── Local models (M1 Max, 64 GB)   → well-specified sub-tasks
                                            (zero ongoing token cost)
```

**Well-specified tasks are what small local models do best.** "Implement this function, make these tests pass" is a different universe from "design this system." So the factory writes precise specs in the cloud and executes them locally for free.

## Drawing the line

The "idle hardware" problem turned out to be my misreading of the machines. One M1 Max is my daily driver. The other — 1 TB, too small for dev plus models — is being sold. The M4 Mini is a stable single-node inference host. Nothing sits idle.

The honest summary, in one line: **measured routing, not religion.** Local where local wins — batch, classification, sovereignty-required workloads, zero-cost well-specified execution. Cheap flash cloud where the cloud wins — agentic engineering. The cluster experiment failed spectacularly, and it was worth every minute: it's the negative half of the evidence for what my Macs can and can't do.

That evidence — full benchmarks, log forensics, the discovery-patch details, the cost analysis — lives on the [exo cluster project page](/projects/exo-cluster/), with the raw report, because a claim you can verify isn't marketing. Next up: what one Mac *can* serve — single-node MoE at 60 tok/s, which is the story the [Model Ops Lab](/projects/model-ops-lab/) is already telling, and a Sovereign AI validation post that follows this episode.