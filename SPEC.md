# Token broker for AI agents

## What it is

A tool that lets an AI authenticate and use sensitive info when it needs to,
by handing it tokens instead of the real credential.

## The problem

Today, if an AI agent needs to use your Stripe key, GitHub token, or database
password, you have to give it the real thing. Once it reads the value, that
value is in the model's context — which means it's in the transcript, and in
whatever logs that transcript touches. You can't take it back. You can only
rotate the credential.

## The model: Apple Cash

Apple Pay does not send your card number to the merchant. It sends a Device
Account Number — a different number tied to that card on that device — plus a
one-time cryptogram for that single purchase. The merchant never receives
anything worth stealing.

This tool does the same thing for AI agents.

| Apple Pay | This tool |
|---|---|
| Real card number | Real password or API key |
| Device Account Number | Token the agent holds |
| Secure Element | Keychain + a process the agent can't read |
| One-time cryptogram | One credential per action |
| Merchant sees only the token | The API sees only the token |
| Kill the token, card survives | Revoke the token, password survives |
| Card spending limits | Usage limits enforced locally |

## How it works

The tool sits between the agent and the credential. Two paths:

**When the service issues tokens** (GitHub, Stripe, AWS, anything with OAuth):
the tool holds the real credential and mints a narrow, expiring token for the
specific job. The agent gets the token. If it leaks, it opens one door and
expires on its own.

**When the service does not** (most databases, older vendor APIs): the tool
holds the real credential itself, runs the command in a separate process with
the credential in that process's environment, and removes any copy of it from
the output before the agent sees it. Weaker, but still better than handing it
over.

Either way, the agent never receives a value it could reuse elsewhere.

## v1 scope

Runs locally on macOS. Node/TypeScript. Exposed to the agent as an MCP server.

- `list_credentials` — returns names only, never values
- `run_with_credential` — runs a command with a credential available to it,
  returns the output with the credential removed
- A local usage limit per credential: N uses per day, and which hosts are
  allowed. The tool refuses past that, regardless of what the service permits.
- An append-only log: what was requested, what ran, whether the filter fired

First service: GitHub, using a fine-grained token scoped to one repo with an
expiry date.

## What v1 is not

- Not a defense against an agent deliberately trying to extract a credential.
  A cleverly written command can defeat the output filter. This stops
  accidents, not attacks.
- Not a replacement for a password manager.
- Not cross-platform. macOS only.
- No server, no account, no data leaving the machine.

## Open

- Whether the tool blocks disallowed commands or only records them.
  Starting with recording; blocking lists tend to get deleted in week two.
- Whether usage is announced live in the terminal or only written to the log.
