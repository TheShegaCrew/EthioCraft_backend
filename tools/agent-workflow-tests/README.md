Automated agent workflow tests

Usage (quick):

- Set environment variables: `AUTH_TOKEN`, `BASE_URL` (optional, defaults to http://localhost:4000/api/v1), and any IDs you want to test (`DRAFT_ID`, `SAMPLE_ID`, `ORDER_ID`).
- Run the bash runner:

```bash
./run-tests.sh
```

Or run the Node test (gives nicer JSON output):

```bash
node run-tests.js
```

Notes:
- These scripts perform authenticated requests; provide a valid `AUTH_TOKEN` (Bearer token) for a user with the appropriate role (artisan, verification agent, or customer) depending on the test.
- The scripts only exercise the endpoints and print responses. Paste outputs here if you want me to analyze failures.
