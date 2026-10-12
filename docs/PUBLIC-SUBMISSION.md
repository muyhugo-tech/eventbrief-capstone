# Public submission

The deliverable is a standalone snapshot of selected source files and synthetic fixtures. Local conversations, API credentials, raw development receipts, screenshots, spending records, private historical handoff notes, and source-project Git history are excluded.

## Create the package

```sh
node scripts/public-check.mjs
node scripts/public-check.mjs --export
```

The first command lists findings by file, line, and rule without printing matched secrets. Fix every working-tree finding before exporting. The second command creates a new ZIP under `out/submission/`, including a SHA-256 manifest for every source file. It refuses to overwrite an existing ZIP.

The allowlist includes application code, tests, documentation, authored fixtures, prompts, evaluation definitions, the public `.impeccable/design.json` design sidecar, and `.env.example` with a blank key. Other design-review/session artifacts are excluded. Symlinks, unexpected binary files, nested private folders, suspicious credential strings, personal absolute paths, non-example email addresses, and known private service URL forms block export. The scan is heuristic; it does not prove that all possible personal data or secrets are absent.

## Verify the exact submission

1. Unzip the new archive into a separate folder.
2. Confirm the only top-level folder is `eventbrief`.
3. Open a terminal in that folder.
4. Run `node scripts/public-check.mjs`, `npm test`, and `npm run check:fixtures`.
5. Run `npm start` and use the saved-example walkthrough in [DEMO.md](DEMO.md).
6. Check `PUBLIC-MANIFEST.json` against the intended source files.

The exported folder contains no `.git` directory and no saved local state. It can be reviewed as a fresh repository before publication. Do not copy a private parent project, `.env.local`, or `out/` into it.

## Git history is a separate boundary

```sh
node scripts/public-check.mjs --history
```

This optional command examines reachable objects in this standalone development repository and reports historical content findings. It counts author/committer email identities without printing them. It does not read the parent project's history, rewrite history, create a remote, or publish anything.

Even when the current working tree passes, earlier commits can contain private workstation paths, operational notes, and commit identities. **Use the reviewed fresh export for the public repository; do not push the development repository's existing history by default.** A content scan cannot establish ownership or licensing permissions.

## Publication decisions

The capstone owner must select a publication license and confirm the course's attribution/AI-assistance requirements. No license has been invented or implied here. The current `private: true` package flag prevents accidental npm publication; it does not prevent sharing the repository for review.

The application can be demonstrated locally. Public hosting and an unauthenticated paid API endpoint are not included. If hosting is later required, authentication, access controls, deployment secrets, and an appropriate spending boundary need a separate implementation.
