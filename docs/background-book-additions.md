# Background book additions

- [Adding and tracking books](#adding-and-tracking-books)
- [Retry and recovery](#retry-and-recovery)
- [Session scope](#session-scope)
- [Implementation boundary](#implementation-boundary)

## Adding and tracking books

Choose a Kyobo result, select the destination and book options, then select **Add to library**. The addition runs while you search for another book or open a library. Header searches and library filters use client-side navigation to keep pending additions visible.

The **Book additions** control shows the number of active requests. Expand it to see each book, its destination, and its result. Collapse it to keep working; this does not cancel requests. Different books can run independently. Repeated submissions of the same product to the same library are guarded while pending and until a successful or existing-book entry is dismissed.

Successful entries provide links to the book and library. Completion refreshes current data without redirecting or moving focus. Progress is indeterminate because Kyobo retrieval does not expose a completion percentage. The panel supports Korean and English, keyboard controls, and screen-reader status announcements.

## Retry and recovery

Failed entries retain the submitted options in memory. **Retry addition** repeats that snapshot; **Edit options** opens the original review page and restores available choices. Removed shelves or folders are cleared. Expired sessions show a sign-in link.

A lost network response means the save outcome is unknown. Check the library or retry explicitly; the app never retries automatically. If the book already exists, the task resolves to **already in library** with a view/edit link. That request does not overwrite existing options or create a new book or creation audit record. It cannot establish which earlier attempt saved the book. Open the saved book to change its options.

## Session scope

Tasks survive navigation inside the current app tab, including ordinary searches and library filtering. An explicit browser reload, closed tab, or changed signed-in account clears task status and retained options. A request may already have saved its book when its status is lost; inspect the library before trying again. These are open-tab background requests, not persistent server jobs. Manual book entry retains its existing behavior.

## Implementation boundary

The root layout hosts a user-scoped client provider. Each addition posts to `/api/books/kyobo`, which authenticates the user, checks the request origin, and awaits the shared server-only import service before returning a `created`, `existing`, or error result. The service validates destination access and options, retrieves canonical Kyobo metadata, and saves the book and audit record transactionally. The legacy Server Action uses the same service while retaining its redirect and duplicate-error contract.

Reverse proxies must forward the public host and protocol through trusted `X-Forwarded-Host` and `X-Forwarded-Proto` headers. The POST origin must match that public origin; direct deployments use the request host and protocol. The proxy must replace client-supplied forwarding headers. The feature adds no database migration or external queue. The existing check-before-create duplicate detection is retained; it is not an exactly-once guarantee across tabs or users.
