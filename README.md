# flopper a card game training app

An experiment in developing a card game training application.

Goals/Features include:

- Texas Hold 'em pre-flop training (*work in progress*)
- Texas Hold 'em post-flop training (*future feature*)
- Omaha pre-flop training (*future feature*)
- Blackjack Hit/stand/double training (*future feature*)

## Technical

The app is primarily designed to run as a progressive web app from a static site. The side effect of using `Expo` and `React Native` is that it can also work as a native iOS or Android app. These are secondary goals.

**WARNING**: I've been using this as an experiment with AI coding. Thus far most of the core work has been done with `ChatGPT-5`. I've patched up bits and peices that just seemed silly to send to AI to complete and parts it did not seem to understand.

## Pre-flop Trainer

Hotkeys:

- 'c' check
- 'a' call
- 'f' fold
- 'r' raise/bet
- 'space' new hand
- 'enter' repeat last action
