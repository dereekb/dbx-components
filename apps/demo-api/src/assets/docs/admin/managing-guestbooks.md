---
title: Managing guestbooks
description: Admin-only guide to creating guestbooks and moderating entries.
tags: [guestbook, admin]
audience: [admin]
---

# Managing guestbooks

Admins moderate guestbooks and their entries. Users can only sign a guestbook once it is published.

## Creating a guestbook

Call `guestbook.create` with a `name`. A new guestbook is unpublished; publish it with `guestbook.update.publish` once
it is ready for entries.

## Moderating entries

`guestbookEntry.invoke.allPublishedEntries` returns every published entry across all guestbooks in one call. It needs
the `lms` scope when called with an OIDC token.

### Unpublishing an entry

Update the entry with `published: false` through `guestbookEntry.update.insert`. The entry stays in Firestore but is
no longer listed.
