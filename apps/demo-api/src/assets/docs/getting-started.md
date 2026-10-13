---
title: Getting started with the Demo API
description: What the Demo API is and how an agent finds its way around it.
tags: [overview, mcp]
audience: [any]
---

# Getting started with the Demo API

The Demo API is the dbx-components sample backend. It serves guestbooks, guestbook entries, profiles and
notifications, and every model call it exposes is also reachable over MCP.

## Finding a method

Search the API by keyword (for example "create guestbook"), read the method's parameter schema, then call it with the
read or write tool, passing `{ method, params }`. Method ids look like `guestbook.create` or
`guestbookEntry.invoke.entryDetails`.

## Reading documentation

Documentation is split into pages and sections. Search returns a page id and, when a section matched, the section id,
so a client can read just that section instead of the whole page.
