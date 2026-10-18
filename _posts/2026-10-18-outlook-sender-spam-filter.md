---
layout: post
title: "A sender-based spam filter for Outlook.com that never reads the email"
description: "Calendar spam from Outlook Groups and inbox spam from plausible names with keyboard-mash addresses. A deterministic, metadata-only filter built on Microsoft Graph: no LLM reads the mail, every move is reversible, and it learns from what I drag out of Junk."
author: Mark Richards
date: 2026-10-18
---

*Drafted by Duncan ([duncanclaw.ai](https://duncanclaw.ai)), Mark's AI assistant. Edited and proofread by Mark Richards. 18 October 2026.*

I have a personal Outlook.com account that's about twenty years old. Over the last few weeks it started receiving two kinds of rubbish that Outlook's own filtering wasn't catching:

1. **Calendar invitations from Outlook Groups I never joined.** Blocking the sender stopped the emails. It didn't stop the events appearing on my calendar.
2. **Inbox spam from people with plausible names and implausible addresses.** "Tori Cooper" writing from something like `qixavubote27@gmail.com`.

This is a write-up of what I built to deal with both, what worked, and what I got wrong on the way.

## Constraint: no language model reads the mail

The obvious fix in 2026 is to hand the inbox to an LLM and ask it what's spam. I didn't, because spam is written by the attacker. Feeding subjects and bodies into a model that has access to my mail and calendar is a prompt-injection channel I'd be building on purpose.

So the rules were:

- Read only **message metadata**: the sender's address, the display name, the received time and the folder.
- **Never** read subjects, bodies, links or attachments.
- Make decisions with **deterministic code**: same input, same output.
- Write sender details only to **private local log files**. Anything printed or reported shows counts and fixed reason codes only.
- Every action must be **reversible**.

I used an AI assistant to write and test the code. It doesn't sit in the runtime path.

## Stack

- **Python 3**, standard library only (plus `websockets` for one browser step).
- **Microsoft Graph**, using a delegated OAuth token for the personal account. Graph works fine for personal Outlook.com accounts, which I hadn't been sure of.
- **macOS `launchd`** running the jobs: one every 60 seconds for calendar and mail, one every 5 minutes for the browser work.
- **`unittest`** with synthetic fixtures only. The suite is at 120 tests.

## Part 1: calendar invitations

The calendar job reads only each event's organiser and a few flags, then deletes:

- events organised by an address whose domain is **exactly** `groups.outlook.com` (exact match, so `groups.outlook.com.evil.example` doesn't qualify);
- invitations from organisers who aren't in my contacts.

The safeguards are where most of the code is:

- My own events are never touched. That matters because another tool of mine creates calendar entries from text messages.
- Anything dated before a fixed cutoff is left alone.
- If loading contacts fails, nothing is deleted.
- Each candidate is re-read just before deletion, and the deletion is confirmed by a 404 afterwards.
- No accept, decline or cancel responses are ever sent.

Recurring series were the fiddly part. A new spam series is deleted whole. For an older or ambiguous series, the master event is kept, and each future occurrence after the cutoff is checked and removed individually, out to a rolling two-year horizon. You can't enumerate an endless series, so the horizon simply moves forward each run.

## Part 2: the inbox filter

### What Outlook can't do

Outlook rules can say "if from X, do Y". They can't say "if *not* from anyone I trust, do Y". There's no negation against a safe list, so this part had to live outside Outlook.

### Safe Senders isn't in the API

My first assumption was that Graph would expose the Outlook.com Safe Senders list. It doesn't. `mailboxSettings` has no junk configuration in v1.0 or beta, and the Exchange PowerShell cmdlets don't apply to consumer accounts.

Outlook on the web obviously has the list, so I checked how it gets it. It calls an internal endpoint, `GetMailboxJunkEmailConfiguration`. The tool now opens the junk-mail settings page in a dedicated, already-signed-in Chrome profile over the DevTools protocol and captures that response. It confirms the signed-in account, then closes the tab. My list had 1,361 entries. They're stored as SHA-256 hashes and re-read hourly.

This is the most fragile part of the whole thing: it depends on Outlook web's internals, and Microsoft can change those whenever it likes. If the snapshot is missing, the filter moves nothing. If it's stale, it still protects everything it already lists and flags itself as stale.

### Decision order

For each new Inbox message, the first match wins:

1. Malformed sender address → keep.
2. From me → keep.
3. I've taught it something about this sender (see below) → do that.
4. On a safe list → keep. That means any of:
    - my contacts;
    - Outlook Safe Senders;
    - anyone I've emailed in the last two years (taken from Sent Items, hashed, refreshed hourly);
    - a local allowlist.
5. Suspicious-identity score reaches the threshold → Junk.
6. Unknown sender on a free-mail domain (Gmail, Hotmail, Bigpond and so on) → Junk.
7. Otherwise → keep.

### The identity score

It uses the part of the address before the @ and the display name:

| Signal | Test | Points (free-mail / other domain) |
|---|---|---|
| Random-looking address | Of the adjacent letter pairs, at least 40% aren't in a list of ~400 pairs common in English and romanised names, or vowels are under 15% | 2 / 1 |
| Digits mixed into letters | e.g. `a8f3k2q` | 2 / 1 |
| Digits on the end | `…ote27` | 1 / 1 |
| Name doesn't match address | see below; free-mail only | 2 / – |
| Display name contains a different email address | "support@yourbank.com" sent from somewhere else | 3 / 3 |

A sender is suspicious if the total is at least **4** *and* comes from **at least two different signals**. No single signal is enough, however strong.

**Name matching.** The display name is simplified first: accents are removed (José → jose) and German spellings evened out (Müller ≈ mueller). It then counts as matching the address if any of these hold:

- a name word of three or more letters appears in it;
- it's an initial plus surname, or first name plus initial;
- it's the first three letters of two name words.

A match also cancels the random-address signal.

**What isn't judged at all** (no points either way):

- names that are mostly non-Latin script;
- names containing digits;
- organisation-style names ("Team", "Support", "Billing", "Pty Ltd" and so on).

The worked example: "Tori Cooper" from `qixavubote27@gmail.com` gets random address (2) + name mismatch (2) + digits on the end (1) = **5 from three signals → Junk**. The same name from `tori.cooper84@gmail.com` matches, so it's just 1 point → not suspicious.

The honest limits:

- The letter-pair test is biased towards English. Some Polish and Welsh surnames look random to it, though that alone can only reach 2 points.
- A careful spammer using `tori.cooper@gmail.com` gets straight past the score.

That's why rule 6 exists.

### Rule 6 does most of the work

When I looked at what was actually getting through, all of it came from **strangers on free-mail accounts**. People who legitimately email me are almost always in my contacts, on Safe Senders, or someone I've written to. So unknown free-mail senders go to Junk.

The cost is real: a genuinely new person on Gmail lands in Junk the first time. That's what the next part is for.

### Learning from what I do

Each run takes a snapshot of which messages are in the Inbox and which are in Junk, and compares it with the previous run:

- A message that moves **from Junk to any folder other than Deleted Items** means its sender is now trusted. Message IDs are requested in Graph's immutable format, so a moved message can still be found wherever it ends up.
- A message I move **from Inbox into Junk** myself means its sender is blocked.
- The latest action per sender wins. It overrides contacts and Safe Senders, but never my own address.
- Mail that Outlook delivers straight to Junk never teaches a block.

The aim is that I only ever rescue a given sender once.

### Safety mechanics

- **Moves go to Junk only.** Never Deleted Items, never permanent deletion. The policy I settled on: Junk is what the system decided I don't want; Deleted Items is what I decided to delete.
- **A ledger** keyed on a hash of each message's Internet Message-ID means no message is processed twice.
- **Before moving,** each candidate is re-read and re-decided. After moving, it's checked that it really is in Junk.
- **No more than 25 moves per run.**
- **Modes:** `off`, `dry-run`, `scored` and `strict`. Live modes only act on mail arriving after the moment they were switched on. Clearing older mail is a separate, explicit command.
- **`restore`** moves recorded messages back to the Inbox and marks their senders as trusted.
- **`explain`** prints the decision and reason codes for any address and name without moving anything:

```
$ python -m spam_guard.sender_filter explain qixavubote27@gmail.com "Tori Cooper"
{"action": "junk", "codes": ["SCORED_SUSPICIOUS", "NAME_MISMATCH",
 "RANDOM_LOCAL_PART", "TRAILING_DIGITS", "FREEMAIL_DOMAIN"], "score": 5, "threshold": 4}
```

## The dry run that changed my mind

My original instinct was "anyone not on my safe list goes to Junk". Before switching anything on, I ran both policies in dry-run mode against the 451 messages in my Inbox:

- **Strict** (everyone not known): **388 moved.** That's 86% of my inbox.
- **Scored**, identity score only: **2 moved.**

Strict would have buried my actual mail; scoring alone barely touched anything. Adding Outlook Safe Senders to the safe list brought "known" senders from 63 to 338 of 447. Adding the free-mail rule caught what the score missed.

Results once it was live:

- **This weekend:** 23 messages checked, 4 moved, all spam. The one legitimate company email stayed.
- **Backlog:** 26 older candidates, which I reviewed myself first. 23 were junk. The other 3 were real people from years ago who are now allowlisted.

## Things I found while I was in there

- **104 Outlook rules** built up over the years. Among them:
    - three were empty shells, duplicating working rules and doing nothing;
    - one moved a newsletter into Archive;
    - one deleted Instagram mail outright;
    - 50 only fire if the message was addressed directly to me, so anything that reaches me as a BCC or through a mailing list quietly skips them.

    Seven were removed, after taking a backup.
- **An older hourly automation** I'd built in n8n was still moving marketing mail into Deleted Items. That's now retired.
- **A forgotten folder tree from a years-old Gmail import.** 90 emails, moved into a single holding folder; every move recorded so it can be undone.

## What doesn't work yet

- **The Groups leaver** uses browser automation to leave each Group. It clicks Leave and confirms, but on the last remaining Group the membership survives. It reports that as an error rather than a success, which is at least honest. I don't yet know whether Outlook is rejecting the request or my check is wrong.
- **No log rotation** yet, and failure alerts are local Mac notifications only.
- **The code still has my account details in it.** That has to change before anyone else can use it.

## Next

It runs unchanged for the rest of October as an MVP. After that:

- **Folder structure.** About 390 folders, nested up to ten levels deep, become four top-level folders with a couple of sub-folders each. Search is good enough now that I don't need to remember a filing scheme I invented years ago.
- **Outlook rules managed from one reviewed list,** rather than edited by hand one at a time.
- **A cleaned-up, configurable version** that other people can run. Small businesses on Microsoft 365 get proper Exchange APIs for some of this, so they'd need a different connector from my browser workaround.

If your business mailbox has the same problem, [get in touch](/contact/).
