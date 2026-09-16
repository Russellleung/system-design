# Deck Of Cards / Blackjack

## Question

Design a deck of cards or blackjack game.

## Clarifying Questions

* Generic deck or Blackjack-specific?
* Number of players?
* Dealer rules?
* Betting in scope?
* Need shuffle randomness testability?

## Core Objects

```text
Card
Suit
Rank
Deck
Hand
Player
Dealer
Game
ScoringPolicy
```

## Main Operations

```text
shuffle()
deal()
hit(player)
stand(player)
score(hand)
determineWinner()
```

## Invariants

```text
A card can only be dealt once from a deck.
A hand score follows game rules.
Game cannot accept actions after it is finished.
Dealer follows fixed rules.
```

## AI Prompt

```text
Create a Java Blackjack model.
Use Card, Deck, Hand, Player, Dealer, and BlackjackGame.
Make shuffle injectable so tests are deterministic.
Add tests for Ace scoring and bust logic.
```

## Tests

```text
deck has 52 unique cards
dealt card removed from deck
ace counts as 1 or 11
player busts over 21
dealer draws until 17
```

## Tradeoffs

```text
Inject random/shuffler for deterministic tests.
Keep scoring policy separate from hand storage.
Avoid mixing UI/input with game rules.
```

## Strong Answer

> I would keep the deck and hand generic, then put Blackjack-specific scoring into a policy. That lets us test card movement separately from game rules.

## 30-Minute Interview Shape

### Build In 30 Minutes

```text
Suit enum
Rank enum
Card
Deck
Hand
Player
Dealer
BlackjackScoringPolicy
BlackjackGame
```

### Hard Part To Emphasize

```text
Deck uniqueness and card movement.
Ace scoring as 1 or 11.
Game state controls allowed actions.
```

### Deeper Edge Cases

```text
deck cannot deal same card twice
empty deck
multiple aces
player hits after standing
dealer draws until soft/hard 17 depending on rule
determine winner after bust/blackjack/push
```

### Production Extension

```text
inject shuffler/random for deterministic tests
support multiple decks/shoe
betting and settlement separated from game rules
state machine for player turns
audit log for dealt cards in real-money game
```

### 30-Minute Closing

> I would implement the deck, hand scoring, and a simple game flow. The most important tests are 52 unique cards, Ace scoring, bust logic, and invalid actions after the game or turn has ended.
