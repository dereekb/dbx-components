---
title: Signing a guestbook
description: How a signed-in user leaves an entry in a guestbook.
tags: [guestbook]
audience: [user]
---

# Signing a guestbook

Any onboarded user can sign a published guestbook. An entry belongs to the user who wrote it, and only they (or an
admin) can change it.

## Writing an entry

Create or update your entry with `guestbookEntry.update.insert`. Set a `message` and the name you `signed` with, and
set `published` when it should be shown to everyone. Each user has one entry per guestbook.

## Checking an entry

`guestbookEntry.invoke.entryDetails` is a read method: it returns the message and signature lengths, the like count and
the entry's age without changing anything.
