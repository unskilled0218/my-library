# Security boundaries

- User and administrator credentials and database sessions use separate tables and cookies. A user can never be promoted to administrator.
- Every library, book, cover, transfer, statistics, and audit request is authorized on the server.
- Folder hierarchy mutations validate library ownership, sibling uniqueness, and parent cycles; uploaded folder covers are served only to authorized library members.
- Kyobo book and genre URLs are canonical and validated. Covers are downloaded from an allowlisted HTTPS host, signature-checked, and served from protected local storage.
- Kyobo result pages show a bounded, display-only preview from the search response while canonical product metadata loads. Only the canonical product scrape is used when a book is added.
- EPUB and PDF files are size- and signature-checked, stored under generated keys, and downloadable only by authorized library members.
- Imports are bounded, validated, previewed, and applied transactionally. Credentials, memberships, sessions, and audit logs are never exported.
- Kyobo scraping uses an ordinary Chromium session because direct HTTP product requests return an empty CloudFront response in the target environment. It does not use stealth or access-control bypasses.
