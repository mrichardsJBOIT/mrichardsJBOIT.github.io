---
layout: post
title: "Teaching my phone to put its own appointments in my calendar"
description: "I wanted texts about appointments to land in my calendar automatically. Getting there meant fighting Android's SMS restrictions, a retired phone command, an auth model that treats personal accounts as second-class citizens, and a proxy that silently broke everything. Here's what actually worked."
author: Mark Richards
date: 2026-10-17
---

## The text that started it

It arrived on a Thursday afternoon, the way they always do — mid-task, mid-thought, mid-something-else.

A message from a medical centre. An appointment had been booked for me: a weekday, a specific time, an address. Reply **Y** to confirm, **N** to cancel.

Nothing unusual. I get a dozen messages a week like it. And that is exactly the problem. This one was a calendar entry wearing the costume of a text message. Somewhere in my phone's notification shade sat a date, a time, and a place, and the only thing standing between that information and my actual calendar was *me* — reading it, remembering it, opening an app, and typing it in.

I have done that small chore thousands of times. Read it, decide it matters, open the calendar, type it in, close the tab. Forty seconds, give or take. Which does not sound like much until you multiply it by a few hundred a year and realise the total is larger than most side projects.

So I did the obvious thing and handed it to an agent. Not "write me an app" — just: *deal with this.* Watch the texts, work out which ones are real appointments, put them in my calendar, and only bother me when you are unsure.

What follows is the honest version. Four of the five steps fought back, in four completely different ways, and the last one nearly shipped a silent bug that would have made the whole thing look like it was working when it was not. But it did get finished — and along the way it turned into the clearest demonstration I have seen of why an agent with a real workspace is a different kind of tool from a service you subscribe to.

It got the appointment right, by the way. First live run, real message, no prompting. I will come back to that.

## The shape of the problem

Strip it down and there are only a few moving parts: something that sees the texts, something that decides which ones matter, and something that writes to the calendar. Three boxes and two arrows. Nothing about that diagram is hard.

Everything *around* those boxes is. Where does the text-reading happen, given that Android has opinions about who is allowed to read SMS? Which machine does the deciding, and does it need the internet to do it? Whose calendar, and authenticated how? And what happens to the ninety-odd percent of messages that are not appointments at all?

Every one of those questions turned out to have a wall behind it.

So I set out to build it: watch my SMS, work out which messages are real appointments, and write those straight into my calendar. Local models only, no cloud.

What follows is the honest version — including the four places the stack actively resisted, because those turned out to be more interesting than the bits that just worked.

## The shape of the thing

The design is simple to describe:

1. A listener on the phone sees incoming messages.
2. A machine at home polls that listener, over a private network.
3. A **local** model classifies each message: is this an appointment with a real date, or is it noise?
4. If it is confident, write the event to my calendar.
5. Everything else gets ignored silently.

Five steps. Four of them fought back.

<figure class="diagram">
<svg viewBox="0 0 720 400" role="img" aria-label="Sequence diagram: an SMS arrives on the phone, a home machine polls it every five minutes, a local model classifies the message, a gate checks it, and only a confident appointment with a parseable date is written to the calendar; the outcome is fed back into an example store." xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
  <defs>
    <marker id="arw" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 z" fill="#334155"/>
    </marker>
    <marker id="arwg" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 z" fill="#0f766e"/>
    </marker>
  </defs>

  <g font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="11" fill="#64748b" text-anchor="middle">
    <text x="110" y="16">PHONE</text>
    <text x="360" y="16">HOME MACHINE</text>
    <text x="612" y="16">CLOUD</text>
  </g>
  <g stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 4">
    <line x1="110" y1="26" x2="110" y2="388"/>
    <line x1="360" y1="26" x2="360" y2="388"/>
    <line x1="612" y1="26" x2="612" y2="388"/>
  </g>

  <g font-family="ui-sans-serif,system-ui,sans-serif" font-size="11.5" fill="#0f172a">
    <line x1="110" y1="52" x2="356" y2="52" stroke="#334155" stroke-width="1.3" marker-end="url(#arw)"/>
    <text x="233" y="46" text-anchor="middle" fill="#64748b" font-size="10.5">1. SMS arrives — notification posted</text>
    <text x="233" y="66" text-anchor="middle" fill="#0f766e" font-size="10">read-only listener, no SMS permission</text>

    <line x1="360" y1="98" x2="114" y2="98" stroke="#334155" stroke-width="1.3" marker-end="url(#arw)"/>
    <text x="237" y="92" text-anchor="middle" fill="#64748b" font-size="10.5">2. poll every 5 minutes</text>

    <path d="M360,124 h56 v26 h-56" fill="none" stroke="#0f766e" stroke-width="1.4" marker-end="url(#arwg)"/>
    <text x="424" y="136" fill="#0f766e" font-size="10.5">3. local model classifies</text>
    <text x="424" y="150" fill="#0f766e" font-size="9.5">schema-constrained · no cloud</text>

    <rect x="322" y="166" width="76" height="38" rx="6" fill="none" stroke="#cbd5e1"/>
    <text x="360" y="181" text-anchor="middle" font-size="10">4. the gate</text>
    <text x="360" y="195" text-anchor="middle" font-size="9" fill="#64748b">appointment + confidence + date</text>

    <line x1="360" y1="238" x2="608" y2="238" stroke="#334155" stroke-width="1.3" marker-end="url(#arw)"/>
    <text x="484" y="232" text-anchor="middle" fill="#64748b" font-size="10.5">5a. PASS — write event (calendar API)</text>

    <line x1="360" y1="268" x2="360" y2="300" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arw)"/>
    <text x="368" y="288" fill="#64748b" font-size="10.5">5b. FAIL — drop, or ask if unsure</text>

    <line x1="360" y1="332" x2="608" y2="332" stroke="#334155" stroke-width="1.3" marker-end="url(#arw)"/>
    <text x="484" y="326" text-anchor="middle" fill="#64748b" font-size="10.5">6. daily digest mail</text>

    <path d="M360,356 h56 v24 h-56" fill="none" stroke="#0f766e" stroke-width="1.4" marker-end="url(#arwg)"/>
    <text x="424" y="372" fill="#0f766e" font-size="10.5">7. outcome → example store</text>
  </g>
</svg>
<figcaption>Green steps never leave hardware I own. Only steps 1, 5a and 6 touch the network at all.</figcaption>
</figure>

## Problem one: Android does not want you reading SMS

The obvious first move is to read the SMS inbox directly. Android has an `SMS` permission group for exactly this, and the automation app on my phone asked for it.

**The permission was denied, with no way to grant it.**

Android has spent the last several releases locking down SMS access, because it is a favourite target for malware. From Android 10 onward, `READ_SMS` and `SEND_SMS` are restricted to the **default messaging app**. A regular app can't just request them. If you're not the default messenger, you can't hold the permission — the toggle doesn't even appear in the Permissions screen, which is genuinely confusing when you go looking for it.

There is a workaround: temporarily set the automation app as the default messaging app, grant the permission, then switch back. But here's the thing — I didn't want to change my default messaging app to support a hobby project. That is a lot of blast radius for a convenience feature.

**What saved it:** the phone's app already had a **notification listener** enabled. When an SMS arrives, the Messages app posts a notification, and the listener reads *that*. It is read-only, it needs no SMS permission at all, and it gives you the message text, the sender, and a timestamp.

The trade-off is real and worth stating plainly: a notification listener is **not a queue**. It sees messages as they arrive, while it is running and connected. It cannot scroll back through your existing inbox. If the app is offline when a message lands and the notification is later dismissed, that message is simply gone from your pipeline's point of view. For a "new appointments as they happen" feature, that is fine. For "process my whole history", it is useless.

## Problem two: the command I needed had been retired

With notifications flowing, the next job was writing to the calendar — and this is where the documentation and the running system disagreed with each other.

The platform's command policy listed a calendar-write command as *dangerous by default*, requiring an explicit opt-in allowlist entry. Fine. I added it to the allowlist.

The error changed from "requires opt-in" to **"the platform does not support this command."**

Digging into the shipped policy code, the command was in a set called `RETIRED_PHONE_CONTROL_SEEDED_DENY_COMMANDS` — sitting alongside camera capture, screen recording, and UI automation. It had not merely been disabled; it had been **withdrawn**. The phone could read calendars all day, but nothing in this build could write to one.

This is the kind of thing documentation drifts on. A doc comment says "gated"; the lockfile, or in this case the policy module, says "retired". Always believe the running code.

**The fix was to stop trying to write from the phone at all.** Write from a machine that already has a proper API path. Which led directly to problem three.

## Interlude: what the agent already had

Before I describe the auth failure, it is worth explaining *why* the fix was available at all — because this is the part that makes the whole exercise feel like a category change rather than a hack.

My agent runs inside a workspace that is, structurally, a developer's environment. It has shell access, file access, a package manager, a credential store, and — crucially — the ability to *write new tools for itself* when the existing ones are not enough.

For the mail side of this project, that meant the agent did not have to wait for a vendor integration or a supported plugin. It could reach the mailbox the same way any mail client does: **IMAP over OAuth2, with XOAUTH2 bearer auth instead of a password.** Thunderbird does exactly this. So does every other desktop mail client. The difference is that instead of clicking through a settings dialog once, the flow became a small script the agent owns, runs, and can extend.

That script now supports:

| Capability | What it means |
|---|---|
| `status` | check whether the OAuth token is still valid |
| `folder list` | walk the entire mailbox hierarchy |
| `list --limit N --folder F` | recent messages from any folder |
| `read <uid> --format text/html/full` | pull one message, in whichever form is useful |
| `folder create` | make a new folder |
| `move <uid> --from-folder X --to-folder Y` | file messages server-side |
| `send` | submit mail over SMTP with the same token |

None of this is exotic. Individually, every one of those is something a mail app has done for twenty years. The point is what happens when they become **composable, scriptable primitives inside an agent's workspace**: the agent can read a message, decide what it is, act on it, and file it — in one run, unprompted, with no UI in the loop.

The reason this matters for *this* project is that the calendar write needed an authenticated path into a personal Microsoft account. The agent already had a working OAuth device-code flow for that account, `offline_access` refresh, and a token cache outside the repository. Extending it was adding one scope and one function, not building an integration from scratch.

This is the quiet advantage of an agent with a real workspace: the mail client is not a black box you configure. It is a set of commands you can read, test, and change — and it degrades gracefully, in the sense that when something fails you can see *exactly* which layer failed.

Which is how I found the next problem.

## Problem three: personal accounts are second-class citizens

I wanted events in a personal Outlook.com calendar. There were two candidate paths, and both failed for different reasons — which is itself the lesson.

**Path A: SMTP.** Send the event as a calendar invite to the mailbox and let the mail client file it. Microsoft's SMTP endpoint accepts OAuth2, and the token I had carried a scope called `SMTP.Send`. It still returned an authentication error.

The reason is audience. That token was minted for the **Graph** API. The SMTP endpoint wants a token whose audience is the *Outlook* resource. A token with the right scope and the wrong audience is, to the SMTP server, a token with the wrong scope. The scope name matches. The token does not.

**Path B: the Graph API's send endpoint.** This needs a scope called `Mail.Send`. My token had `SMTP.Send` — a *different* permission with a confusingly similar name — so the call came back `403 AccessDenied`.

And you cannot fix either of these with a silent token refresh. When I tried requesting the missing scope, the identity platform answered plainly:

> `AADSTS70000: one or more scopes requested are unauthorized or expired. The user must first sign in and grant the client application access to the requested scope.`

Scopes are consent, not configuration. You cannot programmatically grant yourself access a human never approved. The fix is a one-time interactive sign-in via device code — the same flow you use when adding a mail account to a desktop client.

There was a smaller trap worth recording too. The send endpoint returns an **empty 202** on success. My HTTP helper assumed every successful response had a JSON body and crashed on the first real send. It had never worked, because it had never successfully sent anything. A crash on your first real success is a strange debugging moment.

The deeper lesson: **work-tenanted** Microsoft accounts and **personal** Microsoft accounts are genuinely different animals wearing the same API. Error messages rarely say which one you're holding.

## Problem four: the proxy that broke everything, silently

This one is my favourite, because it did not fail loudly.

The classifier — a local model on a home machine — was returning plausible-looking answers, but every single one was coming from a fallback path, never the model. The model call was erroring with `502 Bad Gateway` and being quietly caught and replaced by a deterministic rule pass.

The cause: the host environment injects `HTTP_PROXY` and `HTTPS_PROXY` for controlled cloud egress. Python's standard HTTP client honours those variables automatically. So my local call to a machine on my own private network was being routed **through a proxy designed for the public internet** — and that proxy, quite correctly, refused to reach a private address.

The same call worked perfectly from the command line, because the CLI bypasses the proxy for private hosts. So the behaviour differed by *how* you made the call, not *what* you asked for.

The fix is trivial once found — explicitly bypass the proxy for local addresses — but the failure mode is the dangerous part. Everything "worked". Confidence scores looked reasonable. Results looked plausible. The only tell was a suspiciously uniform distribution and an error field I had been treating as noise.

**A silent, plausible fallback is worse than a crash.** If a fallback path produces output that looks like real output, you will trust it, and you will be wrong.

## What actually shipped

- The phone exposes notifications; a machine at home polls them over a private network every few minutes.
- A **local** model (`Qwen`-class, running on an Apple Silicon box) classifies each message with a **schema-constrained** prompt — it can only emit one of six labels, so it cannot wander.
- A gate: the message must be labelled an appointment, score at or above a confidence floor, **and** contain a parseable date. A claimed appointment with no readable date is demoted. The date check is what stops a hallucinated time from ever reaching the calendar.
- Confident appointments are written to the calendar via the Graph API directly. Each event carries a note recording the sender, the confidence, and the original text, so any entry can be audited after the fact.
- Everything else — chit-chat, bills, delivery notices, one-time codes — is dropped without ceremony.
- A daily digest email lists what was added, what was ignored, and anything the model was unsure about.
- Outcomes are appended to a file and fed back into the prompt as few-shot examples. It gets better at *your* messages specifically, rather than messages in general.

The classification runs entirely on hardware I own, over a network I control. The only external service is the calendar API itself, because that is where the calendar lives.

<figure class="diagram">
<svg viewBox="0 0 720 300" role="img" aria-label="Decision flow: a message arrives, is it an appointment? If no, drop it silently. If yes, is the confidence at or above the floor? If no, escalate to chat. If yes, is there a parseable date? If no, demote to review. If yes, write the event to the calendar." xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
  <defs>
    <marker id="arw2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 z" fill="#334155"/>
    </marker>
    <marker id="arw2r" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 z" fill="#94a3b8"/>
    </marker>
    <marker id="arw2g" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 z" fill="#0f766e"/>
    </marker>
  </defs>
  <g font-family="ui-sans-serif,system-ui,sans-serif" font-size="11.5" fill="#0f172a">

    <rect x="20" y="130" width="104" height="40" rx="8" fill="none" stroke="#cbd5e1"/>
    <text x="72" y="155" text-anchor="middle" font-size="10.5">message in</text>
    <line x1="124" y1="150" x2="166" y2="150" stroke="#334155" stroke-width="1.3" marker-end="url(#arw2)"/>

    <rect x="168" y="126" width="132" height="48" rx="8" fill="none" stroke="#cbd5e1"/>
    <text x="234" y="146" text-anchor="middle" font-size="10.5">is it an</text>
    <text x="234" y="160" text-anchor="middle" font-size="10.5">appointment?</text>

    <line x1="300" y1="150" x2="342" y2="150" stroke="#334155" stroke-width="1.3" marker-end="url(#arw2)"/>
    <text x="321" y="143" text-anchor="middle" font-size="9.5" fill="#0f766e">yes</text>

    <rect x="344" y="126" width="132" height="48" rx="8" fill="none" stroke="#cbd5e1"/>
    <text x="410" y="146" text-anchor="middle" font-size="10.5">confident</text>
    <text x="410" y="160" text-anchor="middle" font-size="10.5">enough?</text>

    <line x1="476" y1="150" x2="518" y2="150" stroke="#334155" stroke-width="1.3" marker-end="url(#arw2)"/>
    <text x="497" y="143" text-anchor="middle" font-size="9.5" fill="#0f766e">yes</text>

    <rect x="520" y="126" width="132" height="48" rx="8" fill="none" stroke="#cbd5e1"/>
    <text x="586" y="146" text-anchor="middle" font-size="10.5">date</text>
    <text x="586" y="160" text-anchor="middle" font-size="10.5">parseable?</text>

    <line x1="652" y1="150" x2="694" y2="150" stroke="#0f766e" stroke-width="1.4" marker-end="url(#arw2g)"/>
    <rect x="640" y="196" width="70" height="36" rx="8" fill="none" stroke="#0f766e"/>
    <text x="675" y="218" text-anchor="middle" font-size="10.5" fill="#0f766e">write it</text>
    <path d="M656,174 h19 v22 h-19" fill="none" stroke="#0f766e" stroke-width="1.2" marker-end="url(#arw2g)"/>
    <text x="684" y="160" text-anchor="middle" font-size="9.5" fill="#0f766e">yes</text>

    <line x1="234" y1="174" x2="234" y2="232" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arw2r)"/>
    <text x="226" y="200" text-anchor="end" font-size="9.5" fill="#94a3b8">no</text>
    <text x="236" y="252" font-size="10.5" fill="#64748b">drop silently — the ninety percent</text>

    <line x1="410" y1="174" x2="410" y2="232" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arw2r)"/>
    <text x="402" y="200" text-anchor="end" font-size="9.5" fill="#94a3b8">no</text>
    <text x="412" y="252" font-size="10.5" fill="#64748b">ask in chat</text>

    <line x1="586" y1="174" x2="586" y2="232" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arw2r)"/>
    <text x="578" y="200" text-anchor="end" font-size="9.5" fill="#94a3b8">no</text>
    <text x="588" y="252" font-size="10.5" fill="#64748b">demote to review</text>

  </g>
</svg>
<figcaption>The gate is the whole design. Everything before it is plumbing; everything after it is consequences.</figcaption>
</figure>

## Why this is an agent story, not a scripting story

It would be easy to file this under "I wrote some Python". That undersells what changed.

The old shape of this problem is: identify a need, find a service that supports it, and adapt your workflow to whatever that service does. If no service supports it — and for "read my personal Outlook over an unsupported auth path, classify the contents with a local model, and write to my calendar" no service does — the request stops there.

The new shape is: the agent has a workspace, and the workspace is a real computer you can shape. So the request does not stop. The agent investigated, hit four hard walls, worked out what each wall actually was, built its own mail client from primitives, consented to one scope on my behalf, found and fixed a transport bug that was silently poisoning its own output, and left behind a documented, tested, reusable tool — all of which it can now operate on its own schedule.

That last part is the real shift. The finished pipeline does not need me at the keyboard. Every few minutes it checks the phone, classifies what it finds, writes the real appointments, quietly drops the noise, and mails me a daily summary. When it is unsure, it asks. When it is right, it learns — outcomes go back into the example store, so it gets better at *my* messages over time.

Compare that to the alternative: a cloud service that reads my SMS (which Android will not allow anyway), a handful of connected accounts, and a monthly fee. Instead, the classification runs on a machine in my office, the only external calls are to APIs I already use, and the whole thing is code I can read, test, and change.

And crucially — the agent could *narrate its own failure*. When the proxy silently degraded every result to a fallback, the fix was findable precisely because the agent could inspect its own layers: the HTTP client, the token contents, the response codes. A black-box integration gives you an error message. A workspace gives you the whole stack.

## The bits I'd tell you to remember

1. **Believe the running system over the documentation.** A doc comment said "gated". The shipped policy said "retired". They were both in the same repository.
2. **A permission with the right name and the wrong audience is not the right permission.** `SMTP.Send` and `Mail.Send` are not interchangeable, and the error message will not explain why.
3. **Scopes are consent.** No amount of token refreshing substitutes for a human approving access once.
4. **Your local calls are probably going through a proxy you forgot about.** If the same request behaves differently from two different tools, suspect the transport before the server.
5. **Never let a fallback path look like a success path.** If it can fail quietly and produce plausible output, add a loud marker so it can't.

The whole thing took an afternoon, two of which were spent on the proxy.

## Back to the text

Remember the message that started this? The medical centre, the weekday, the time, the address.

It was still sitting in the notification shade when the pipeline first went live. So that is what the first real run got handed — not a test fixture, not a sample string I had typed in to flatter myself. A genuine message from a genuine stranger, arriving through the real channel, at the real speed.

The classifier read it, labelled it an appointment, and pulled out the date, the time, and the location. Confidence: **0.98**. For context, the deterministic fallback path — what runs when the model is unreachable — scores everything at a flat **0.5**, because a rule engine does not really "decide", it just fails safely.

So the first thing this system ever did, unasked, was put a real appointment in my calendar. Correctly.

I did not have to read it. I did not have to decide it mattered. I did not have to open an app, or remember a date, or type anything at all. The forty-second tax just… did not get charged.

And then it kept going. The next messages through were a payment confirmation, a food delivery notice, an ordinary conversation, and a credit-card alert. It ignored all four — verification code, delivery, chit-chat, finance — and bothered me about none of them. Which is, honestly, the harder half of the problem. Anyone can build something that shouts about appointments. Building something that *knows when to shut up* is what makes it liveable.

That is the whole point. Not that it is clever, but that it is **quiet and right** — and that it keeps running when I am not looking.

---

*Next on the list: teaching it to tell the difference between "your appointment is Tuesday" and "would Tuesday suit you?" — which is a substantially harder problem than dates and labels, and exactly the sort of thing a small local model should be good at. And now that the agent can read and file mail as well as write calendar entries, the same shape applies to the inbox itself: classify, act, file, report — without me opening a mail client at all.*
