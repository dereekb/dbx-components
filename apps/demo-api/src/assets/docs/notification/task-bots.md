---
title: Notification task bots
description: Short sample guide to the demo ping task bot, its opt-outs and its run triggers.
tags: [notification, taskbot]
audience: [user]
---

# Notification task bots

A task bot runs scripted entries on a schedule for its owner. The demo ships one script, a ping, that a user can start
on their own profile with `profile.update.createTestNotificationTaskBot`.

## Opting out

The bot's owner can list the script groups they may opt out of with `notificationTaskBot.read.optOuts`, then turn a
group off or back on with `notificationTaskBot.update.optOut`. Only the owner can undo an opt-out.

## Run triggers

Each run records what triggered it as a `NotificationTaskBotRunTrigger` value: `0` (scheduled), `1` (manual) or `2`
(forced). Look the table up with the `enum-info` read method to decode a stored value.
