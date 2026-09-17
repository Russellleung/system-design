# Deck Of Cards / Blackjack

## Question

Design an in-memory single-player Blackjack game against a dealer.

## Clarifying Questions

* Single player or multiple players?
* Does the dealer stand or hit on soft 17?
* Are betting and multiple decks required?
* Must shuffle be deterministic in tests?

Assume one player, one deck, dealer stands on all 17s, and no betting.

## Components To Implement

```text
Suit, Rank, Card
Deck, Hand
Player, Dealer
GameState, BlackjackScoringPolicy, BlackjackGame
```

## Relationships And Services

```text
Deck owns undealt Cards.
Player and Dealer each own one Hand.
Hand owns dealt Cards but does not calculate game flow.
BlackjackGame owns the current participants, Deck, and GameState.
No repository or service is needed for one in-memory game.
```

## Main Operations

```text
start()
hit()
stand()
playDealer()
determineWinner()
```

## Invariants

```text
A card is dealt at most once from a Deck.
Ace value adjusts from 11 to 1 as needed.
Actions are accepted only in the correct GameState.
Dealer follows the configured draw rule.
Winner is calculated once the game is finished.
```

## AI Prompt

```text
Implement a single-player Java Blackjack game using Suit, Rank, Card, Deck,
Hand, Player, Dealer, GameState, BlackjackScoringPolicy, and BlackjackGame.

Support start, hit, stand, dealer play, and winner calculation. Aces count as 11
unless converting them to 1 avoids a bust. Dealer stands on all 17s. Inject a
Shuffler or preset deck so tests are deterministic. Reject actions in the wrong
state.

Deck owns undealt cards; Player and Dealer own their Hands; BlackjackGame owns
the Deck, participants, and GameState. BlackjackScoringPolicy calculates scores
without storing state. Do not add repositories, services, or global collections.

Use plain Java with no betting, UI, persistence, or multiple players. Add focused
JUnit tests for deck uniqueness, Aces, busts, dealer play, and invalid actions.
```

## Tests

```text
new deck contains 52 unique cards
dealt card leaves the deck
one and multiple Aces score correctly
player bust ends the turn
dealer draws below 17 and stands at 17
hit after stand or completion is rejected
blackjack, bust, win, loss, and push resolve correctly
```

## Tradeoffs And Follow-Ups

```text
Card, Deck, and Hand stay generic; scoring and flow hold Blackjack rules.
Injected order makes tests deterministic.
Production/extension can add a multi-deck shoe and configurable dealer rules.
Betting and settlement remain separate from game rules.
```

## Strong Answer

> I kept Card, Deck, and Hand generic, while BlackjackScoringPolicy and BlackjackGame own the specific rules. An injected deck order makes Ace, bust, dealer, and winner scenarios deterministic. Betting remains a separate concern.
