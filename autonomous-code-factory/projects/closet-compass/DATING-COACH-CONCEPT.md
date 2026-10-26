# Dating Coach concept

Status: concept only; not implemented.

## Goal

Help a user understand a dating conversation, write better replies and track communication patterns without automatically controlling a dating account.

Start with Hinge, but keep the analysis independent of any one dating platform.

## Hinge constraint

Do not build an unofficial direct Hinge connector.

Hinge currently prohibits:

- automated extraction, crawling and data mining;
- third-party services that directly interact with Hinge or member content, including AI/ML systems, without written consent;
- use of the Hinge API without written consent.

An unofficial connector, accessibility scraper or auto-messaging bot could violate Hinge's terms and put the user's account at risk.

Source: [Hinge Terms of Use](https://hinge.co/terms)

Hinge offers an official user data export, but:

- it can take up to 30 days;
- it may not contain everything needed for live conversation analysis;
- it excludes some personal information about other members.

Source: [Hinge data-export guidance](https://help.hinge.co/hc/en-us/articles/360004792234-How-can-I-make-a-Data-Request)

An official real-time integration should be considered only after receiving written permission or partnership access from Hinge.

## Safe MVP

Build a separate Dating Coach that accepts information deliberately supplied by the user:

1. Paste a conversation.
2. Upload screenshots for on-device OCR.
3. Import an official Hinge data export when available.
4. Add relevant profile prompts and dating preferences manually.
5. Review suggested replies before copying them into Hinge.

The app must not log into Hinge, scrape screens in the background, swipe, send likes or send messages automatically.

## Analytics

### Responsiveness

- Median reply time for each person.
- Reply time relative to each person's normal pattern.
- Recent reply-time trend.
- Unanswered-message streaks.
- Time-of-day and overnight adjustments.

### Reciprocity

- Message-count balance.
- Word-count and message-length balance.
- Who starts or restarts conversations.
- Questions asked and answered.
- Whether both people introduce new topics.

### Conversation quality

- References to details from earlier messages.
- Humour, warmth and emotional openness.
- Generic replies versus specific replies.
- Whether messages are becoming longer or shorter.
- Whether the conversation is progressing toward a specific date.

### Date intent

- Vague interest versus a specific time and place.
- Follow-through after making plans.
- Repeated postponement without an alternative.
- Balance of effort in arranging the meeting.

## Results

Do not report fabricated probabilities such as:

> They are 82% romantically interested.

Report an evidence-based indicator with uncertainty:

> Engagement: moderately strong  
> Confidence: medium  
> They reply more slowly than you, but their messages are detailed, contain questions and increasingly refer to future plans.

Reply speed is not interest by itself. Work, sleep, notification habits, culture and communication style can affect timing and message length.

## Separate scores

### Engagement

Observable effort in the conversation:

- responsiveness;
- reciprocity;
- initiative;
- warmth;
- continuity;
- willingness to make plans.

### Compatibility

Alignment discovered from explicit profile or conversation evidence:

- relationship goals;
- values;
- lifestyle;
- communication needs;
- location;
- children;
- finances;
- long-term plans.

Compatibility cannot be inferred reliably from response time or message length alone.

### Conversation momentum

Whether the interaction is becoming more engaged, staying flat or fading over time.

## Reply coaching

For a selected message, provide:

- a short explanation of what the message may be signalling;
- a playful reply;
- a direct reply;
- a warm reply;
- advice on whether to ask a question, suggest a date or give space;
- warnings when a draft sounds needy, generic, aggressive, manipulative or over-engineered;
- a concise explanation of why each suggestion may work.

The system must never impersonate the user or send a message automatically. The user chooses, edits and sends every reply.

## Privacy

- Process OCR on-device where practical.
- Redact names, phone numbers and other direct identifiers before model analysis.
- Do not retain screenshots or raw conversations by default.
- Make deletion immediate and visible.
- Do not use conversations for model training without explicit opt-in.
- Analyse only content the user has the right to provide.
- Treat the other participant's messages as sensitive personal information.
- Never expose one user's conversations to another user.

## Suggested architecture

```text
Manual paste / screenshot / official export
                    |
                    v
        Local parser and OCR
                    |
                    v
      Redaction + message timeline
          |                   |
          v                   v
Deterministic metrics    Selected text excerpt
          |                   |
          +--------+----------+
                   v
          Coaching model
                   |
                   v
  Engagement evidence + reply drafts
                   |
                   v
        User reviews and copies
```

Use deterministic code for timing, counts and trends. Use an LLM only for conversational interpretation and reply drafting.

## Recommended delivery stages

### Stage 1: manual coach

- Paste one conversation.
- Parse sender and timestamps.
- Display basic engagement metrics.
- Generate three editable reply options.
- Store nothing after the session by default.

### Stage 2: screenshot import

- On-device OCR.
- User confirms detected messages and speakers.
- Automatic identifier redaction.
- Conversation timeline and trend charts.

### Stage 3: official export import

- Import only fields present in Hinge's official export.
- Explain missing or incomplete data.
- Analyse longer-term conversation patterns.

### Stage 4: broader compatibility coach

- Compare explicit goals, values and lifestyle preferences.
- Let the user correct every extracted claim.
- Separate compatibility evidence from engagement signals.

### Stage 5: official integration

Only after written platform authorization:

- OAuth or approved account connection;
- platform-supported event synchronization;
- documented retention and deletion controls;
- no autonomous sending unless explicitly supported and deliberately approved.

## MVP success criteria

- A user can paste a conversation and correct its parsed structure.
- Metrics are reproducible from timestamps and text.
- Every interest or compatibility assessment cites its supporting messages or behaviour.
- Uncertain interpretations are labelled uncertain.
- The app produces useful reply options without sending them.
- Raw conversation data can be deleted immediately.
- The implementation does not connect to or automate Hinge.

