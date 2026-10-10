# Settings scope

- Display preferences belong to the signed-in user and apply when that user views any owned or shared library.
- Shelf tags belong to a library owner and are shared by all libraries that account owns. Editors can assign the owner's tags to books but cannot manage the owner's global tag collection.
- Library-specific settings retain their existing permissions: statistics are readable by library members, while sharing, ownership, transfer, and audit controls are owner-only.
- Library folders can contain books and more folders. Owners and editors can manage folders and move books; viewers can browse them. Folder covers may reference a book cover or use an uploaded JPEG, PNG, or WebP image in the existing protected cover volume.
- Version 3 library backups preserve folder trees, book assignments, book-derived folder covers, and uploaded folder covers. Version 1 and 2 backups remain importable with their books at library root. CSV preserves escaped folder paths but intentionally omits folder cover images.
- General Settings can export and import one versioned JSON backup containing every owned library plus account display preferences, language, shelf tags, and folder organization. Imports create new libraries without replacing existing collections; account backup files are limited to 50 MB, 100 libraries, 5,000 books, and 5,000 folders. EPUB/PDF binaries and attachment metadata are excluded from JSON and CSV, so restore them only with their matching database and `book_files` volume backup.
